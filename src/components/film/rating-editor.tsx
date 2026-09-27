"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button, QuietButton } from "@/components/button";
import { QuestionRenderer } from "@/components/form/question-renderer";
import { Markdown } from "@/components/markdown";
import { RcaChip } from "@/components/rca/rca-chip";
import {
  RcaMultiselect,
  type RcaOption,
} from "@/components/rca/rca-multiselect";
import { Stars } from "@/components/ui/stars";
import { dateInTimeZone } from "@/lib/dates";
import type {
  RuntimeFormConfig,
  RuntimeQuestionConfig,
} from "@/lib/form-config";
import { getSecondaryFormConfig } from "@/lib/secondary-scoring";
import {
  formatButtonScaleValue,
  normalizeLegacyButtonScaleValue,
} from "@/lib/button-scale";
import {
  computeOverallFromForm,
  evaluateFormConditions,
  type AnswerMap,
  type AnswerValue,
} from "@/lib/scoring";
import { formatScore, type ScoreScale } from "@/lib/score-format";
import { useIsOwner } from "@/lib/use-is-owner";

export function RatingEditor({
  filmId,
  filmTitle,
  genres,
  status,
  publishedForm,
  ratedForm,
  initialAnswers,
  initialOverall,
  scale,
  allRcaTags,
  initialRcaTags,
  startEditing = false,
}: {
  filmId: number;
  filmTitle: string;
  genres: string[];
  status: string;
  publishedForm: RuntimeFormConfig;
  ratedForm: RuntimeFormConfig | null;
  initialAnswers: AnswerMap;
  initialOverall: number | null;
  scale: ScoreScale;
  allRcaTags: RcaOption[];
  initialRcaTags: RcaOption[];
  startEditing?: boolean;
}) {
  const router = useRouter();
  const makeEditingAnswers = () =>
    answersForPublishedForm(publishedForm, ratedForm, initialAnswers);
  const [answers, setAnswers] = useState<AnswerMap>(makeEditingAnswers);
  const [tags, setTags] = useState(allRcaTags);
  const [selectedIds, setSelectedIds] = useState(
    initialRcaTags.map(({ id }) => id),
  );
  // "Rate a film" opens the form even when the film already has a rating.
  const [editing, setEditing] = useState(!ratedForm || startEditing);
  // Guests only ever see the saved rating.
  const owner = useIsOwner();
  const showEditor = owner && (editing || !ratedForm);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const formRef = useRef<HTMLElement>(null);
  const formHeaderRef = useRef<HTMLElement>(null);
  const bannerRef = useRef<HTMLDivElement>(null);
  // True while the form's own score header is scrolled out of view.
  const [bannerShown, setBannerShown] = useState(false);

  // The page streams in after navigation, so the browser's own jump to #rate
  // happens too early. Scroll once the form exists.
  useEffect(() => {
    if (startEditing && showEditor)
      formRef.current?.scrollIntoView({ block: "start" });
  }, [startEditing, showEditor]);

  // Show the banner once the form header passes under the site header, and
  // hide it again after the end of the form scrolls past.
  useEffect(() => {
    if (!showEditor) return;
    let frame = 0;
    function update() {
      frame = 0;
      const header = formHeaderRef.current;
      const form = formRef.current;
      const banner = bannerRef.current;
      if (!header || !form || !banner) return;
      // The banner's CSS top is the site header height plus the notch inset.
      const top = parseFloat(getComputedStyle(banner).top) || 0;
      setBannerShown(
        header.getBoundingClientRect().bottom < top &&
          form.getBoundingClientRect().bottom > top + banner.offsetHeight,
      );
    }
    function schedule() {
      if (!frame) frame = window.requestAnimationFrame(update);
    }
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [showEditor]);
  const conditionStates = useMemo(
    () => evaluateFormConditions(publishedForm, answers, genres),
    [answers, publishedForm, genres],
  );
  const score = useMemo(() => {
    try {
      return computeOverallFromForm(publishedForm, answers, genres);
    } catch {
      return null;
    }
  }, [answers, publishedForm, genres]);
  const terms = new Map(
    score?.terms.map((term) => [term.questionId, term]) ?? [],
  );
  const secondary = secondaryScore(publishedForm, answers, genres);
  const progress = useMemo(() => {
    const open = publishedForm.questions.filter((question) => {
      const state = conditionStates[question.id];
      return (
        !isDisplayElement(question) &&
        !question.archivedAt &&
        (state?.visible ?? true) &&
        (state?.enabled ?? true)
      );
    });
    return {
      answered: open.filter((question) => answerPresent(answers[question.id]))
        .length,
      total: open.length,
    };
  }, [answers, conditionStates, publishedForm]);

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
        !isDisplayElement(question) &&
        question.required &&
        state.visible &&
        state.enabled &&
        !answerPresent(answers[question.id])
      );
    });
    if (missing.length > 0) {
      setMessage(
        `Answer required: ${missing.map(({ label }) => label).join(", ")}.`,
      );
      // Take the user to the first unanswered question.
      document
        .getElementById(`question-row-${missing[0].id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
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

  if (!showEditor && !ratedForm)
    return (
      <section className="panel px-5 py-6 sm:px-7">
        <p className="eyebrow">Your rating</p>
        <p className="text-paper-300 mt-2 text-sm">Not rated yet.</p>
      </section>
    );

  if (!showEditor && ratedForm) {
    const savedStates = evaluateFormConditions(
      ratedForm,
      initialAnswers,
      genres,
    );
    const breakdownSections = formSections(ratedForm)
      .map((section) => ({
        ...section,
        questions: section.questions.filter(
          (question) =>
            !isDisplayElement(question) && savedStates[question.id]?.visible,
        ),
      }))
      .filter((section) => section.questions.length > 0);

    return (
      <section id="rate" className="panel scroll-mt-20 overflow-hidden">
        <header className="border-hairline flex items-end justify-between gap-5 border-b px-5 py-5 sm:px-7">
          <div>
            <p className="eyebrow">Your rating</p>
            <h2 className="type-section-heading text-paper-100 mt-1">
              The breakdown
            </h2>
            {ratedForm.id !== publishedForm.id ? (
              <span className="text-accent-400 mt-2 inline-block text-xs">
                rated under v{ratedForm.id}
              </span>
            ) : null}
          </div>
          <div className="text-right">
            <p className="type-score text-accent-400">
              {formatScore(initialOverall, scale)}
              <span className="text-paper-500 ml-1 text-base">/ {scale}</span>
            </p>
            {initialOverall !== null ? (
              <Stars value={initialOverall / 2} className="mt-1 text-sm" />
            ) : null}
            {owner ? (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="link-button mt-1"
              >
                Edit rating
              </button>
            ) : null}
          </div>
        </header>
        <div className="divide-hairline divide-y">
          {breakdownSections.map((section) => {
            const scoreQuestions = section.questions.filter(isScoreQuestion);
            const responseQuestions = section.questions.filter(
              (question) => !isScoreQuestion(question),
            );
            const secondary =
              /secondary/i.test(section.title) ||
              responseQuestions.length > scoreQuestions.length;

            return (
              <section key={section.id}>
                <header className="bg-ink-900 flex items-end justify-between gap-4 px-5 py-3 sm:px-7">
                  <div>
                    <p className="text-accent-400 text-[10px] font-semibold tracking-[0.14em] uppercase">
                      {secondary ? "Secondary responses" : "Primary scores"}
                    </p>
                    <h3 className="text-paper-100 mt-0.5 text-sm font-semibold">
                      {section.title.replace(/\s*\(secondary\)\s*$/i, "")}
                    </h3>
                  </div>
                  <span className="text-paper-500 text-[10px] tracking-wide uppercase">
                    {section.questions.length} responses
                  </span>
                </header>

                {scoreQuestions.length ? (
                  <div className="bg-hairline grid gap-px sm:grid-cols-2 lg:grid-cols-4">
                    {scoreQuestions.map((question) => (
                      <BreakdownScore
                        key={question.id}
                        question={question}
                        answer={initialAnswers[question.id]}
                        selectedTags={selectedTagsForQuestion(
                          tags,
                          selectedIds,
                          question,
                        )}
                      />
                    ))}
                  </div>
                ) : null}

                {responseQuestions.length ? (
                  <div className="bg-hairline grid gap-px md:grid-cols-2">
                    {responseQuestions.map((question) => (
                      <BreakdownResponse
                        key={question.id}
                        question={question}
                        answer={initialAnswers[question.id]}
                        selectedTags={selectedTagsForQuestion(
                          tags,
                          selectedIds,
                          question,
                        )}
                      />
                    ))}
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>
      </section>
    );
  }

  return (
    <>
      {/* Pinned under the site header while the user scrolls the form, so the
          score so far and the Save button stay in reach. */}
      <div
        ref={bannerRef}
        aria-hidden={!bannerShown}
        inert={!bannerShown}
        className={`border-hairline bg-ink-900/95 fixed inset-x-0 top-[calc(58px+env(safe-area-inset-top))] z-40 border-b shadow-lg shadow-black/30 backdrop-blur-md transition-[translate,opacity] duration-200 ${
          bannerShown
            ? "translate-y-0 opacity-100"
            : "pointer-events-none -translate-y-full opacity-0"
        }`}
      >
        <div className="mx-auto flex max-w-[1480px] items-center gap-3 px-4 py-2 sm:px-[clamp(16px,2.4vw,32px)]">
          <div className="min-w-0 flex-1">
            <p className="text-paper-500 truncate text-[11px] font-semibold tracking-[0.12em] uppercase">
              Rating {filmTitle}
            </p>
            <p className="flex items-baseline gap-x-2 whitespace-nowrap">
              <span className="text-accent-400 font-mono text-2xl leading-8 font-semibold tabular-nums">
                {formatScore(score?.overall ?? null, scale)}
              </span>
              <span className="text-paper-500 text-xs">/ {scale}</span>
              <span className="text-paper-500 hidden text-xs tabular-nums sm:inline">
                · second score {formatScore(secondary, scale)}
              </span>
              <span className="text-paper-500 truncate text-xs tabular-nums">
                · {progress.answered} of {progress.total} answered
              </span>
            </p>
          </div>
          {/* A wrapper hides Cancel on phones, where the bar has room for
              one button. QuietButton's own inline-flex would override
              "hidden" on the button itself. */}
          {ratedForm ? (
            <span className="hidden sm:block">
              <QuietButton onClick={cancel}>Cancel</QuietButton>
            </span>
          ) : null}
          <Button
            onClick={() => void save()}
            disabled={saving}
            className="shrink-0"
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
        {message ? (
          // No role="status" here: the footer copy already announces it.
          <p className="text-paper-300 mx-auto line-clamp-2 max-w-[1480px] px-4 pb-2 text-xs sm:px-[clamp(16px,2.4vw,32px)]">
            {message}
          </p>
        ) : null}
      </div>
      <section
        id="rate"
        ref={formRef}
        className="panel scroll-mt-20 overflow-hidden"
      >
        <header
          ref={formHeaderRef}
          className="border-hairline flex flex-col gap-4 border-b px-5 py-5 sm:flex-row sm:items-end sm:justify-between sm:px-7"
        >
          <div>
            <p className="eyebrow">Rate this film</p>
            <h2 className="type-section-heading text-paper-100 mt-1">
              Rating form, version {publishedForm.id}
            </h2>
          </div>
          <div className="flex gap-7 sm:text-right">
            <ScoreReadout
              label="Second score"
              value={secondary}
              scale={scale}
            />
            <ScoreReadout
              label="Score so far"
              value={score?.overall ?? null}
              scale={scale}
              large
            />
          </div>
        </header>
        {formSections(publishedForm).map((section) => (
          <div key={section.id}>
            <div className="border-hairline bg-ink-850 border-y px-5 py-2.5 sm:px-7">
              <h3 className="type-label text-paper-500 tracking-widest uppercase">
                {section.title}
              </h3>
              {section.description ? (
                <Markdown className="mt-1">{section.description}</Markdown>
              ) : null}
            </div>
            <div className="divide-hairline divide-y">
              {section.questions.map((question) => {
                const state = conditionStates[question.id] ?? {
                  visible: true,
                  enabled: true,
                };
                if (!state.visible) return null;
                if (isDisplayElement(question))
                  return (
                    <div
                      key={question.id}
                      className={`px-5 py-5 sm:px-7 ${state.enabled ? "" : "opacity-50"}`}
                    >
                      <QuestionRenderer
                        question={question}
                        value={undefined}
                        disabled={!state.enabled}
                        onChange={() => undefined}
                      />
                    </div>
                  );
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
                if (question.type === "button_scale")
                  return (
                    <div
                      key={question.id}
                      id={`question-row-${question.id}`}
                      className={`px-5 py-6 sm:px-7 ${state.enabled ? "" : "opacity-50"}`}
                      title={
                        state.enabled
                          ? undefined
                          : conditionDescription(question, publishedForm)
                      }
                    >
                      <QuestionRenderer
                        question={question}
                        value={answers[question.id]}
                        disabled={!state.enabled}
                        onChange={(value) => changeAnswer(question.id, value)}
                      />
                      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_minmax(14rem,1fr)]">
                        <div>
                          {retained ? (
                            <span className="text-accent-400 text-[10px] uppercase">
                              not counted
                            </span>
                          ) : null}
                          {term ? (
                            <p className="text-paper-500 text-[10px] tabular-nums">
                              {term.counted
                                ? `${term.points.toFixed(3)} weighted points`
                                : term.reason === "null_option" ||
                                    term.reason === "na"
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
                                  (id) =>
                                    !scopedTags.some((tag) => tag.id === id),
                                ),
                                ...next,
                              ])
                            }
                            onCreate={(label) => createTag(question.key, label)}
                          />
                        ) : null}
                      </div>
                    </div>
                  );
                return (
                  <div
                    key={question.id}
                    id={`question-row-${question.id}`}
                    className={`grid gap-4 px-5 py-5 sm:px-7 lg:grid-cols-[12rem_minmax(14rem,1fr)_minmax(14rem,1fr)] ${state.enabled ? "" : "opacity-50"}`}
                    title={
                      state.enabled
                        ? undefined
                        : conditionDescription(question, publishedForm)
                    }
                  >
                    <div>
                      <label
                        htmlFor={`question-${question.id}`}
                        className="text-paper-100 font-semibold"
                      >
                        {question.label}
                        {question.required ? (
                          <span className="text-accent-400"> *</span>
                        ) : null}
                      </label>
                      {question.helpText ? (
                        <Markdown className="mt-1">
                          {question.helpText}
                        </Markdown>
                      ) : null}
                      {retained ? (
                        <span className="text-accent-400 mt-2 inline-block text-[10px] uppercase">
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
                            : term.reason === "null_option" ||
                                term.reason === "na"
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
        <div className="border-hairline bg-ink-850 grid gap-4 border-t px-5 py-5 sm:px-7 lg:grid-cols-[12rem_1fr]">
          <span className="text-paper-100 font-semibold">Overall why tags</span>
          <RcaMultiselect
            label="Overall why tags"
            options={tags.filter((tag) => tag.questionKey === "overall")}
            selectedIds={selectedIds.filter(
              (id) =>
                tags.find((tag) => tag.id === id)?.questionKey === "overall",
            )}
            onChange={(next) =>
              setSelectedIds((current) => [
                ...current.filter(
                  (id) =>
                    tags.find((tag) => tag.id === id)?.questionKey !==
                    "overall",
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
          {ratedForm ? (
            <QuietButton onClick={cancel}>Cancel</QuietButton>
          ) : null}
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
    </>
  );
}

function answersForPublishedForm(
  published: RuntimeFormConfig,
  rated: RuntimeFormConfig | null,
  initial: AnswerMap,
) {
  return Object.fromEntries(
    published.questions
      .filter((question) => !isDisplayElement(question))
      .map((question) => {
        const previous = rated?.questions.find(
          ({ key }) => key === question.key,
        );
        const previousAnswer = previous ? initial[previous.id] : undefined;
        if (previousAnswer) {
          if (question.type === "button_scale" && previousAnswer.number != null)
            return [
              question.id,
              {
                ...previousAnswer,
                number: normalizeLegacyButtonScaleValue(previousAnswer.number),
              },
            ];
          return [question.id, { ...previousAnswer }];
        }
        if (question.type === "slider") {
          const min = question.min ?? 0;
          const max = question.max ?? 100;
          return [question.id, { number: Math.max(min, Math.min(max, 50)) }];
        }
        return [question.id, undefined];
      }),
  );
}

function isDisplayElement(question: RuntimeQuestionConfig) {
  return question.type === "title" || question.type === "divider";
}

function isScoreQuestion(question: RuntimeQuestionConfig) {
  return (
    question.type === "slider" ||
    question.type === "button_scale" ||
    question.type === "integer"
  );
}

function selectedTagsForQuestion(
  tags: RcaOption[],
  selectedIds: number[],
  question: RuntimeQuestionConfig,
) {
  return tags.filter(
    (tag) => tag.questionKey === question.key && selectedIds.includes(tag.id),
  );
}

function BreakdownScore({
  question,
  answer,
  selectedTags,
}: {
  question: RuntimeQuestionConfig;
  answer: AnswerValue | undefined;
  selectedTags: RcaOption[];
}) {
  return (
    <div className="bg-ink-850 min-w-0 px-4 py-3.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-paper-500 min-w-0 text-[10px] font-semibold tracking-wide uppercase">
          {question.label}
        </span>
        <span className="text-paper-100 shrink-0 text-base font-bold tabular-nums">
          {formatAnswer(question, answer)}
        </span>
      </div>
      {selectedTags.length ? (
        <div className="mt-2.5 flex flex-wrap gap-1">
          {selectedTags.map((tag) => (
            <RcaChip key={tag.id} tag={tag} compact />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function BreakdownResponse({
  question,
  answer,
  selectedTags,
}: {
  question: RuntimeQuestionConfig;
  answer: AnswerValue | undefined;
  selectedTags: RcaOption[];
}) {
  return (
    <div className="bg-ink-850 grid min-w-0 grid-cols-[minmax(6.5rem,0.42fr)_minmax(0,1fr)] gap-3 px-4 py-3 sm:gap-4 sm:px-5">
      <span className="text-paper-500 pt-0.5 text-[10px] leading-4 font-semibold tracking-wide uppercase">
        {question.label}
      </span>
      <div className="min-w-0">
        <p className="text-paper-100 text-sm leading-5 font-semibold">
          {formatAnswer(question, answer)}
        </p>
        {selectedTags.length ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {selectedTags.map((tag) => (
              <RcaChip key={tag.id} tag={tag} compact />
            ))}
          </div>
        ) : null}
      </div>
    </div>
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
  if (answer?.number != null)
    return question.type === "button_scale"
      ? formatButtonScaleValue(answer.number)
      : String(answer.number);
  if (answer?.text) return answer.text;
  if (answer?.optionIds?.length)
    return answer.optionIds
      .map((id) => question.options.find((option) => option.id === id)?.label)
      .filter(Boolean)
      .join(", ");
  return "—";
}

function secondaryScore(
  form: RuntimeFormConfig,
  answers: AnswerMap,
  genres: string[],
) {
  try {
    return computeOverallFromForm(getSecondaryFormConfig(form), answers, genres)
      .overall;
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
        {
          id: 0,
          title: "Other",
          description: "",
          sortOrder: Number.MAX_SAFE_INTEGER,
          questions: unsectioned,
        },
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
  scale,
  large = false,
}: {
  label: string;
  value: number | null;
  scale: ScoreScale;
  large?: boolean;
}) {
  return (
    <div>
      <p className="type-label text-paper-500 uppercase">{label}</p>
      <p
        className={
          large
            ? "type-score text-accent-400"
            : "type-card-title text-accent-400 tabular-nums"
        }
      >
        {formatScore(value, scale)}
        <span className="text-paper-500 ml-1 text-xs">/ {scale}</span>
      </p>
    </div>
  );
}
