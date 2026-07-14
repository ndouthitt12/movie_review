import { eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  answers,
  filmRcaTags,
  films,
  ratings,
  rcaTags,
  watchLog,
} from "@/db/schema";
import {
  getPublishedRuntimeForm,
  type RuntimeQuestionConfig,
} from "@/lib/form-config";
import { getSecondaryFormConfig } from "@/lib/secondary-scoring";
import {
  computeOverallFromForm,
  evaluateFormConditions,
  type AnswerMap,
} from "@/lib/scoring";
import { ratingSchema } from "@/lib/validation";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const id = Number((await params).id);
  const parsed = ratingSchema.safeParse(await request.json().catch(() => null));
  if (!Number.isInteger(id) || !parsed.success)
    return NextResponse.json(
      {
        error: parsed.success
          ? "Invalid film id."
          : (parsed.error.issues[0]?.message ?? "Invalid rating."),
      },
      { status: 400 },
    );
  const [film] = await db
    .select({ status: films.status })
    .from(films)
    .where(eq(films.id, id))
    .limit(1);
  if (!film)
    return NextResponse.json({ error: "Film not found." }, { status: 404 });

  const form = await getPublishedRuntimeForm();
  if (!form || form.id !== parsed.data.formVersionId)
    return NextResponse.json(
      { error: "The published rating form changed. Reload before saving." },
      { status: 409 },
    );
  const questionById = new Map(form.questions.map((question) => [question.id, question]));
  const answerMap: AnswerMap = Object.fromEntries(
    parsed.data.answers.map((answer) => [
      answer.questionId,
      {
        number: answer.valueNumber,
        text: answer.valueText,
        optionIds: answer.valueOptionIds,
        isNa: answer.isNa,
      },
    ]),
  );
  for (const answer of parsed.data.answers) {
    const question = questionById.get(answer.questionId);
    if (!question)
      return NextResponse.json(
        { error: `Question ${answer.questionId} is not part of this form.` },
        { status: 400 },
      );
    const error = validateAnswer(question, answer);
    if (error) return NextResponse.json({ error }, { status: 400 });
  }
  const states = evaluateFormConditions(form, answerMap);
  const missing = form.questions.filter((question) => {
    const state = states[question.id] ?? { visible: true, enabled: true };
    return (
      question.required &&
      state.visible &&
      state.enabled &&
      !answerPresent(answerMap[question.id])
    );
  });
  if (missing.length)
    return NextResponse.json(
      { error: `Answer required: ${missing.map(({ label }) => label).join(", ")}.` },
      { status: 400 },
    );

  let overall: number;
  try {
    overall = computeOverallFromForm(form, answerMap).overall;
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not score rating.",
      },
      { status: 400 },
    );
  }
  const secondary = secondaryScore(form, answerMap);
  const uniqueRcaTagIds = [...new Set(parsed.data.rcaTagIds)];
  const validTags = uniqueRcaTagIds.length
    ? await db
        .select({ id: rcaTags.id })
        .from(rcaTags)
        .where(inArray(rcaTags.id, uniqueRcaTagIds))
    : [];
  if (validTags.length !== uniqueRcaTagIds.length)
    return NextResponse.json(
      { error: "One or more RCA tags no longer exist." },
      { status: 409 },
    );

  const now = new Date().toISOString();
  await db.transaction(async (tx) => {
    await tx.delete(answers).where(eq(answers.filmId, id));
    if (parsed.data.answers.length)
      await tx.insert(answers)
        .values(
          parsed.data.answers.map((answer) => ({
            filmId: id,
            questionId: answer.questionId,
            valueNumber: answer.valueNumber ?? null,
            valueText: answer.valueText ?? null,
            valueOptionIds: answer.valueOptionIds ?? null,
            isNa: answer.isNa,
          })),
        );
    await tx.insert(ratings)
      .values({
        filmId: id,
        formVersionId: form.id,
        overall,
        overallSecondary: secondary,
        ratedAt: now,
      })
      .onConflictDoUpdate({
        target: ratings.filmId,
        set: {
          formVersionId: form.id,
          overall,
          overallSecondary: secondary,
          ratedAt: now,
        },
      });
    await tx.delete(filmRcaTags).where(eq(filmRcaTags.filmId, id));
    if (uniqueRcaTagIds.length)
      await tx
        .insert(filmRcaTags)
        .values(uniqueRcaTagIds.map((rcaTagId) => ({ filmId: id, rcaTagId })));
    if (film.status === "to_watch" && parsed.data.promoteToWatched) {
      const watchedOn = parsed.data.watchedOn!;
      await tx.update(films)
        .set({ status: "watched", lastWatchDate: watchedOn, updatedAt: now })
        .where(eq(films.id, id));
      await tx.insert(watchLog).values({ filmId: id, watchedOn, isRewatch: false });
    }
  });
  return NextResponse.json({ overall, secondary });
}

type ParsedAnswer = ReturnType<typeof ratingSchema.parse>["answers"][number];

function validateAnswer(question: RuntimeQuestionConfig, answer: ParsedAnswer) {
  if (answer.isNa && !question.allowNa)
    return `${question.label} does not allow N/A.`;
  if (question.type === "slider" || question.type === "integer") {
    if (answer.isNa) return null;
    if (answer.valueNumber == null) return null;
    if (question.type === "integer" && !Number.isInteger(answer.valueNumber))
      return `${question.label} must be an integer.`;
    if (question.min != null && answer.valueNumber < question.min)
      return `${question.label} must be at least ${question.min}.`;
    if (question.max != null && answer.valueNumber > question.max)
      return `${question.label} must be at most ${question.max}.`;
  }
  if (
    question.type === "dropdown" ||
    question.type === "multiple_choice" ||
    question.type === "multi_select"
  ) {
    const selected = answer.valueOptionIds ?? [];
    if (question.type !== "multi_select" && selected.length > 1)
      return `${question.label} accepts only one option.`;
    const optionIds = new Set(question.options.map(({ id }) => id));
    if (selected.some((id) => !optionIds.has(id)))
      return `${question.label} contains an invalid option.`;
    const selectedOptions = question.options.filter(({ id }) =>
      selected.includes(id),
    );
    if (
      selectedOptions.some(({ isNull }) => isNull) &&
      selectedOptions.length > 1
    )
      return `${question.label}'s null response cannot be combined with other options.`;
  }
  return null;
}

function answerPresent(answer: AnswerMap[number]) {
  return Boolean(
    answer?.isNa ||
      answer?.number != null ||
      (answer?.text != null && answer.text.trim()) ||
      answer?.optionIds?.length,
  );
}

function secondaryScore(
  form: NonNullable<Awaited<ReturnType<typeof getPublishedRuntimeForm>>>,
  answerMap: AnswerMap,
) {
  try {
    return computeOverallFromForm(
      getSecondaryFormConfig(form),
      answerMap,
    ).overall;
  } catch {
    return null;
  }
}
