import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { answers, films, questionOptions, questions, ratings } from "@/db/schema";
import { getPublishedRuntimeForm, type RuntimeFormConfig } from "./form-config";
import { getSecondaryFormConfig } from "./secondary-scoring";
import { computeOverallFromForm, type AnswerMap, type AnswerValue } from "./scoring";

type PreparedRating = {
  filmId: number;
  title: string;
  before: number;
  after: number;
  secondaryBefore: number | null;
  secondaryAfter: number | null;
  answerMap: AnswerMap;
};

export function preparePublishedRecompute(): { form: RuntimeFormConfig; rows: PreparedRating[] } {
  const form = getPublishedRuntimeForm();
  if (!form) throw new Error("No published form exists.");
  const ratingRows = db
    .select({ filmId: ratings.filmId, title: films.title, before: ratings.overall, secondaryBefore: ratings.overallSecondary })
    .from(ratings)
    .innerJoin(films, eq(films.id, ratings.filmId))
    .all();
  const filmIds = ratingRows.map(({ filmId }) => filmId);
  const rawAnswers = filmIds.length
    ? db.select().from(answers).where(inArray(answers.filmId, filmIds)).all()
    : [];
  const oldQuestionIds = [...new Set(rawAnswers.map(({ questionId }) => questionId))];
  const oldQuestions = oldQuestionIds.length
    ? db.select({ id: questions.id, key: questions.key }).from(questions).where(inArray(questions.id, oldQuestionIds)).all()
    : [];
  const oldOptions = oldQuestionIds.length
    ? db.select({ id: questionOptions.id, questionId: questionOptions.questionId, label: questionOptions.label, isNull: questionOptions.isNull }).from(questionOptions).where(inArray(questionOptions.questionId, oldQuestionIds)).all()
    : [];
  const oldKey = new Map(oldQuestions.map(({ id, key }) => [id, key]));
  const oldOption = new Map(oldOptions.map((option) => [option.id, option]));
  const targetByKey = new Map(form.questions.map((question) => [question.key, question]));

  const rows = ratingRows.map((rating) => {
    const answerMap: AnswerMap = {};
    for (const row of rawAnswers.filter(({ filmId }) => filmId === rating.filmId)) {
      const target = targetByKey.get(oldKey.get(row.questionId) ?? "");
      if (!target) continue;
      const value: AnswerValue = {
        number: row.valueNumber,
        text: row.valueText,
        isNa: row.isNa,
      };
      if (row.valueOptionIds?.length) {
        const labels = row.valueOptionIds.map((id) => oldOption.get(id)?.label).filter((label): label is string => Boolean(label));
        value.optionIds = target.options.filter((option) => labels.includes(option.label)).map(({ id }) => id);
      }
      answerMap[target.id] = value;
    }
    const after = computeOverallFromForm(form, answerMap).overall;
    let secondaryAfter: number | null = null;
    try { secondaryAfter = computeOverallFromForm(getSecondaryFormConfig(form), answerMap).overall; } catch { /* A formula with no countable terms has no result. */ }
    return { ...rating, after, secondaryAfter, answerMap };
  });
  return { form, rows };
}

export function commitPublishedRecompute() {
  const prepared = preparePublishedRecompute();
  const now = new Date().toISOString();
  db.transaction((tx) => {
    for (const row of prepared.rows) {
      tx.delete(answers).where(eq(answers.filmId, row.filmId)).run();
      const answerRows = Object.entries(row.answerMap).map(([questionId, value]) => ({
        filmId: row.filmId,
        questionId: Number(questionId),
        valueNumber: value?.number ?? null,
        valueText: value?.text ?? null,
        valueOptionIds: value?.optionIds ?? null,
        isNa: value?.isNa ?? false,
      }));
      if (answerRows.length) tx.insert(answers).values(answerRows).run();
      tx.update(ratings).set({
        formVersionId: prepared.form.id,
        overall: row.after,
        overallSecondary: row.secondaryAfter,
        ratedAt: now,
      }).where(eq(ratings.filmId, row.filmId)).run();
    }
  });
  return prepared;
}

export function recomputeSummary(rows: PreparedRating[]) {
  const withDelta = rows.map((row) => ({
    filmId: row.filmId,
    title: row.title,
    before: row.before,
    after: row.after,
    delta: row.after - row.before,
  }));
  const changed = withDelta.filter(({ delta }) => Math.abs(delta) >= 5e-4);
  return {
    total: rows.length,
    changed: changed.length,
    maxDelta: changed.reduce((max, { delta }) => Math.max(max, Math.abs(delta)), 0),
    movers: [...changed].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 10),
  };
}
