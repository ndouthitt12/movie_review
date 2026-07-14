"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button, QuietButton } from "@/components/button";
import { QuestionRenderer } from "@/components/form/question-renderer";
import { RcaChip } from "@/components/rca/rca-chip";
import {
  RcaMultiselect,
  type RcaOption,
} from "@/components/rca/rca-multiselect";
import { dateInTimeZone } from "@/lib/dates";
import type {
  RuntimeFormConfig,
  RuntimeQuestionConfig,
} from "@/lib/form-config";
import { getSecondaryFormConfig } from "@/lib/secondary-scoring";
import {
  computeOverallFromForm,
  evaluateFormConditions,
  type AnswerMap,
  type AnswerValue,
} from "@/lib/scoring";

export function RatingEditor({
  filmId,
  status,
  publishedForm,
  ratedForm,
  initialAnswers,
  initialOverall,
  allRcaTags,
  initialRcaTags,
}: {
  filmId: number;
  status: string;
  publishedForm: RuntimeFormConfig;
  ratedForm: RuntimeFormConfig | null;
  initialAnswers: AnswerMap;
  initialOverall: number | null;
  allRcaTags: RcaOption[];
  initialRcaTags: RcaOption[];
}) {
  const router = useRouter();
  const makeEditingAnswers = () =>
    answersForPublishedForm(publishedForm, ratedForm, initialAnswers);
  const [answers, setAnswers] = useState<AnswerMap>(makeEditingAnswers);
  const [tags, setTags] = useState(allRcaTags);
  const [selectedIds, setSelectedIds] = useState(
    initialRcaTags.map(({ id }) => id),
  );
  const [editing, setEditing] = useState(!ratedForm);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const conditionStates = useMemo(
    () => evaluateFormConditions(publishedForm, answers),
    [answers, publishedForm],
  );
  const score = useMemo(() => {
    try {
      return computeOverallFromForm(publishedForm, answers);
    } catch {
      return null;
    }
  }, [answers, publishedForm]);
  const terms = new Map(
    score?.terms.map((term) => [term.questionId, term]) ?? [],
  );
  const secondary = secondaryScore(publishedForm, answers);

  async function createTag(questionKey: string, label: string) {
    const response = await fetch("/api/rca-tags", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        label,
        questionKey,
        polarity: "neutral",
        color: null,
      }),
    });
    const body = (await response.json()) as RcaOption & { error?: string };
    if (!response.ok) throw new Error(body.error ?? "Could not create tag.");
    setTags((current) => [...current, body]);
    return body;
  }

  function changeAnswer(questionId: number, value: AnswerValue) {
    setAnswers((current) => ({ ...current, [questionId]: value }));
  }

  async function save() {
    const missing = publishedForm.questions.filter((question) => {
      const state = conditionStates[question.id] ?? {
        visible: true,
        enabled: true,
      };
      return (
        question.required &&
        state.visible &&
        state.enabled &&
        !answerPresent(answers[question.id])
      );
    });
    if (missing.length > 0) {
      setMessage(`Answer required: ${missing.map(({ label }) => label).join(", ")}.`);
      return;
    }
    if (!score) {
      setMessage("The active scoring divisor must be greater than zero.");
      return;
    }

    let promoteToWatched = false;
    if (status === "to_watch")
      promoteToWatched = window.confirm(
        "Move this film to Watched and add a watch dated today?",
      );
    setSaving(true);
    setMessage("");
    const response = await fetch(`/api/films/${filmId}/rating`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        formVersionId: publishedForm.id,
        answers: Object.entries(answers)
          .filter(([, value]) => answerPresent(value))
          .map(([questionId, value]) => ({
            questionId: Number(questionId),
            valueNumber: value?.number,
            valueText: value?.text,
            valueOptionIds: value?.optionIds,
            isNa: value?.isNa ?? false,
          })),
        rcaTagIds: selectedIds,
        promoteToWatched,
        watchedOn: promoteToWatched ? dateInTimeZone() : undefined,
      }),
    });
    const body = (await response.json()) as { error?: string };
    setSaving(false);
    if (!response.ok) setMessage(body.error ?? "Could not save rating.");
    else {
      setMessage("Rating and why tags saved.");
      setEditing(false);
      router.refresh();
    }
  }

  function cancel() {
    setAnswers(makeEditingAnswers());
    setSelectedIds(initialRcaTags.map(({ id }) => id));
    setEditing(false);
    setMessage("");
  }

  if (!editing && ratedForm) {
    return (
      <section className="panel overflow-hidden">
        <header className="border-hairline bg-ink-850 flex items-end justify-between border-b px-5 py-5 sm:px-7">
          <div>
            <p className="eyebrow">Your rating</p>
            <h2 className="text-paper-100 mt-1 text-2xl font-bold">
              The breakdown
            </h2>
            {ratedForm.id !== publishedForm.id ? (
              <span className="text-accent-300 mt-2 inline-block text-xs">
                rated under {ratedForm.label}
              </span>
            ) : null}
          </div>
          <div className="text-right">
            <p className="text-positive text-3xl font-bold tabular-nums">
              {initialOverall?.toFixed(3) ?? "—"}
            </p>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="link-button mt-1"
            >
              Edit rating
            </button>
          </div>
        </header>
        <div className="bg-hairline grid gap-px sm:grid-cols-2 lg:grid-cols-4">
          {ratedForm.questions.map((question) => {
            const selected = tags.filter(
              (tag) =>
                tag.questionKey === question.key &&
                selectedIds.includes(tag.id),
            );
            return (
              <div key={question.id} className="bg-ink-900 p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-paper-500 text-xs font-semibold tracking-wide uppercase">
                    {question.label}
                  </span>
                  <span className="text-paper-100 text-lg font-bold tabular-nums">
                    {formatAnswer(question, initialAnswers[question.id])}
                  </span>
                </div>
                {selected.length ? (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {selected.map((tag) => (
                      <RcaChip key={tag.id} tag={tag} compact />
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>
    );
  }

  return (
    <section className="panel overflow-hidden">
      <header className="border-hairline bg-ink-850 flex flex-col gap-4 border-b px-5 py-5 sm:flex-row sm:items-end sm:justify-between sm:px-7">
        <div>
          <p className="eyebrow">Runtime form</p>
          <h2 className="text-paper-100 mt-1 text-2xl font-bold">
            {publishedForm.label}
          </h2>
        </div>
        <div className="flex gap-7 sm:text-right">
          <ScoreReadout label="Secondary" value={secondary} />
          <ScoreReadout label="Live overall" value={score?.overall ?? null} large />
        </div>
      </header>
      {formSections(publishedForm).map((section) => (
        <div key={section.id}>
          <div className="border-hairline bg-ink-950 border-y px-5 py-2 sm:px-7">
            <h3 className="text-paper-500 text-xs font-semibold tracking-widest uppercase">
              {section.title}
            </h3>
          </div>
          <div className="divide-hairline divide-y">
            {section.questions.map((question) => {
              const state = conditionStates[question.id] ?? {
                visible: true,
                enabled: true,
              };
              if (!state.visible) return null;
              const scopedTags = tags.filter(
                (tag) => tag.questionKey === question.key,
              );
              const selectedForQuestion = selectedIds.filter((id) =>
                scopedTags.some((tag) => tag.id === id),
              );
              const term = terms.get(question.id);
              const retained =
                answerPresent(answers[question.id]) &&
                term?.reason === "suppressed";
              return (
                <div
                  key={question.id}
                  className={`grid gap-4 px-5 py-5 sm:px-7 lg:grid-cols-[12rem_minmax(14rem,1fr)_minmax(14rem,1fr)] ${state.enabled ? "" : "opacity-50"}`}
                  title={state.enabled ? undefined : conditionDescription(question, publishedForm)}
                >
                  <div>
                    <label
                      htmlFor={`question-${question.id}`}
                      className="text-paper-100 font-semibold"
                    >
                      {question.label}
                      {question.required ? (
                        <span className="text-accent-300"> *</span>
                      ) : null}
                    </label>
                    {question.helpText ? (
                      <p className="text-paper-500 mt-1 text-xs">
                        {question.helpText}
                      </p>
                    ) : null}
                    {retained ? (
                      <span className="text-accent-300 mt-2 inline-block text-[10px] uppercase">
                        not counted
                      </span>
                    ) : null}
                  </div>
                  <div>
                    <QuestionRenderer
                      question={question}
                      value={answers[question.id]}
                      disabled={!state.enabled}
                      onChange={(value) => changeAnswer(question.id, value)}
                    />
                    {term ? (
                      <p className="text-paper-500 mt-2 text-[10px] tabular-nums">
                        {term.counted
                          ? `${term.points.toFixed(3)} weighted points`
                          : term.reason === "null_option" || term.reason === "na"
                            ? "N/A — not counted"
                            : `${term.reason?.replaceAll("_", " ") ?? "not counted"}`}
                      </p>
                    ) : null}
                  </div>
                  {question.rcaEnabled ? (
                    <RcaMultiselect
                      label={`${question.label} why tags`}
                      options={scopedTags}
                      selectedIds={selectedForQuestion}
                      onChange={(next) =>
                        setSelectedIds((current) => [
                          ...current.filter(
                            (id) => !scopedTags.some((tag) => tag.id === id),
                          ),
                          ...next,
                        ])
                      }
                      onCreate={(label) => createTag(question.key, label)}
                    />
                  ) : (
                    <div />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <div className="border-hairline bg-ink-850/40 grid gap-4 border-t px-5 py-5 sm:px-7 lg:grid-cols-[12rem_1fr]">
        <span className="text-paper-100 font-semibold">Overall why tags</span>
        <RcaMultiselect
          label="Overall why tags"
          options={tags.filter((tag) => tag.questionKey === "overall")}
          selectedIds={selectedIds.filter(
            (id) => tags.find((tag) => tag.id === id)?.questionKey === "overall",
          )}
          onChange={(next) =>
            setSelectedIds((current) => [
              ...current.filter(
                (id) =>
                  tags.find((tag) => tag.id === id)?.questionKey !== "overall",
              ),
              ...next,
            ])
          }
          onCreate={(label) => createTag("overall", label)}
        />
      </div>
      <footer className="border-hairline flex flex-wrap items-center gap-3 border-t px-5 py-5 sm:px-7">
        <Button onClick={() => void save()} disabled={saving}>
          {saving ? "Saving…" : "Save rating"}
        </Button>
        {ratedForm ? <QuietButton onClick={cancel}>Cancel</QuietButton> : null}
        <a href="/rubric" className="link-button ml-1">
          Rating rubric
        </a>
        {message ? (
          <p className="text-paper-300 text-sm" role="status">
            {message}
          </p>
        ) : null}
      </footer>
    </section>
  );
}

function answersForPublishedForm(
  published: RuntimeFormConfig,
  rated: RuntimeFormConfig | null,
  initial: AnswerMap,
) {
  return Object.fromEntries(
    published.questions.map((question) => {
      const previous = rated?.questions.find(({ key }) => key === question.key);
      const previousAnswer = previous ? initial[previous.id] : undefined;
      if (previousAnswer) return [question.id, { ...previousAnswer }];
      if (question.type === "slider") {
        const min = question.min ?? 0;
        const max = question.max ?? 100;
        return [question.id, { number: Math.max(min, Math.min(max, 50)) }];
      }
      return [question.id, undefined];
    }),
  );
}

function answerPresent(answer: AnswerValue | undefined) {
  return Boolean(
    answer?.isNa ||
      answer?.number != null ||
      (answer?.text != null && answer.text.trim()) ||
      answer?.optionIds?.length,
  );
}

function formatAnswer(
  question: RuntimeQuestionConfig,
  answer: AnswerValue | undefined,
) {
  if (answer?.isNa) return "N/A";
  if (answer?.number != null) return String(answer.number);
  if (answer?.text) return answer.text;
  if (answer?.optionIds?.length)
    return answer.optionIds
      .map((id) => question.options.find((option) => option.id === id)?.label)
      .filter(Boolean)
      .join(", ");
  return "—";
}

function secondaryScore(form: RuntimeFormConfig, answers: AnswerMap) {
  try {
    return computeOverallFromForm(getSecondaryFormConfig(form), answers).overall;
  } catch {
    return null;
  }
}

function formSections(form: RuntimeFormConfig) {
  const sections = form.sections.map((section) => ({
    ...section,
    questions: form.questions.filter(
      (question) => question.sectionId === section.id && !question.archivedAt,
    ),
  }));
  const unsectioned = form.questions.filter(
    (question) => question.sectionId == null && !question.archivedAt,
  );
  return unsectioned.length
    ? [
        ...sections,
        { id: 0, title: "Other", sortOrder: Number.MAX_SAFE_INTEGER, questions: unsectioned },
      ]
    : sections;
}

function conditionDescription(
  question: RuntimeQuestionConfig,
  form: RuntimeFormConfig,
) {
  const descriptions = question.conditions
    .filter(({ effect }) => effect === "disable")
    .map((condition) => {
      const source = form.questions.find(
        ({ id }) => id === condition.sourceQuestionId,
      );
      return `${source?.label ?? "Earlier question"} ${condition.operator.replaceAll("_", " ")}`;
    });
  return `Enabled when: ${descriptions.join(` ${question.conditionLogic} `)}`;
}

function ScoreReadout({
  label,
  value,
  large = false,
}: {
  label: string;
  value: number | null;
  large?: boolean;
}) {
  return (
    <div>
      <p className="text-paper-500 text-[10px] font-semibold uppercase">
        {label}
      </p>
      <p
        className={`${large ? "text-positive text-3xl" : "text-sky text-xl"} font-bold tabular-nums`}
      >
        {value?.toFixed(3) ?? "—"}
      </p>
    </div>
  );
}
