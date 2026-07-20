"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { QuestionRenderer } from "@/components/form/question-renderer";
import { Markdown } from "@/components/markdown";
import type {
  RuntimeFormConfig,
  RuntimeQuestionConfig,
} from "@/lib/form-config";
import {
  evaluateFormConditions,
  type AnswerMap,
  type AnswerValue,
} from "@/lib/scoring";
import { isDisplayType } from "./constants";

export function Preview({
  form,
  selectedId,
  answers,
  onAnswer,
}: {
  form: RuntimeFormConfig;
  selectedId: number | null;
  answers: AnswerMap;
  onAnswer: (questionId: number, value: AnswerValue) => void;
}) {
  const [mode, setMode] = useState<"question" | "full">("question");
  const selectedRef = useRef<HTMLDivElement>(null);
  const selected = form.questions.find(({ id }) => id === selectedId);
  const states = useMemo(
    () => evaluateFormConditions(form, answers),
    [answers, form],
  );

  useEffect(() => {
    if (mode === "full")
      selectedRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
  }, [mode, selectedId]);

  return (
    <section className="panel min-w-0 overflow-hidden 2xl:sticky 2xl:top-6">
      <header className="border-hairline flex flex-wrap items-center justify-between gap-3 border-b px-4 py-4">
        <div>
          <p className="eyebrow">Inspector preview</p>
          <p className="text-paper-500 mt-1 text-xs">
            Unsaved edits appear here immediately.
          </p>
        </div>
        <div className="rounded-ui border-hairline bg-ink-850 flex border p-1 text-[10px] font-semibold">
          <button
            type="button"
            onClick={() => setMode("question")}
            className={`rounded-ui px-2 py-1.5 ${mode === "question" ? "bg-accent-400 text-ink-950" : "text-paper-500"}`}
          >
            This question
          </button>
          <button
            type="button"
            onClick={() => setMode("full")}
            className={`rounded-ui px-2 py-1.5 ${mode === "full" ? "bg-accent-400 text-ink-950" : "text-paper-500"}`}
          >
            Full form
          </button>
        </div>
      </header>

      <div className="max-h-[70vh] overflow-y-auto p-5">
        {mode === "question" ? (
          selected ? (
            <div>
              {states[selected.id] && !states[selected.id]!.visible ? (
                <p className="text-accent-400 mb-3 text-xs font-semibold">
                  Hidden by current sample answers
                </p>
              ) : null}
              <QuestionPreview
                question={selected}
                value={answers[selected.id]}
                disabled={states[selected.id]?.enabled === false}
                onChange={(value) => onAnswer(selected.id, value)}
              />
            </div>
          ) : (
            <EmptyPreview />
          )
        ) : (
          <FullForm
            form={form}
            states={states}
            selectedId={selectedId}
            selectedRef={selectedRef}
            answers={answers}
            onAnswer={onAnswer}
          />
        )}
      </div>
    </section>
  );
}

function FullForm({
  form,
  states,
  selectedId,
  selectedRef,
  answers,
  onAnswer,
}: {
  form: RuntimeFormConfig;
  states: ReturnType<typeof evaluateFormConditions>;
  selectedId: number | null;
  selectedRef: React.RefObject<HTMLDivElement | null>;
  answers: AnswerMap;
  onAnswer: (questionId: number, value: AnswerValue) => void;
}) {
  const sections = form.sections.map((section) => ({
    ...section,
    questions: form.questions.filter(
      ({ sectionId }) => sectionId === section.id,
    ),
  }));
  const unsectioned = form.questions.filter(
    ({ sectionId }) => sectionId == null,
  );
  if (unsectioned.length)
    sections.push({
      id: 0,
      title: "Other",
      description: "",
      sortOrder: Number.MAX_SAFE_INTEGER,
      questions: unsectioned,
    });

  return (
    <div className="space-y-7">
      {sections.map((section) => (
        <section key={section.id}>
          <header className="border-hairline mb-3 border-b pb-2">
            <h3 className="text-paper-100 text-sm font-bold tracking-wide uppercase">
              {section.title}
            </h3>
            {section.description ? (
              <Markdown className="mt-1">{section.description}</Markdown>
            ) : null}
          </header>
          <div className="space-y-5">
            {section.questions.map((question) => {
              const state = states[question.id] ?? {
                visible: true,
                enabled: true,
              };
              if (!state.visible) return null;
              const selected = question.id === selectedId;
              return (
                <div
                  key={question.id}
                  ref={selected ? selectedRef : undefined}
                  className={`rounded-ui p-3 ${selected ? "ring-accent-400 bg-accent-400/5 ring-2" : ""}`}
                >
                  <QuestionPreview
                    question={question}
                    value={answers[question.id]}
                    disabled={!state.enabled}
                    onChange={(value) => onAnswer(question.id, value)}
                  />
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function QuestionPreview({
  question,
  value,
  disabled,
  onChange,
}: {
  question: RuntimeQuestionConfig;
  value: AnswerValue | undefined;
  disabled: boolean;
  onChange: (value: AnswerValue) => void;
}) {
  if (isDisplayType(question.type))
    return (
      <QuestionRenderer
        question={question}
        value={undefined}
        disabled={disabled}
        onChange={() => undefined}
      />
    );
  if (question.type === "button_scale")
    return (
      <QuestionRenderer
        question={question}
        value={value}
        disabled={disabled}
        onChange={onChange}
      />
    );
  return (
    <div className={disabled ? "opacity-50" : ""}>
      <label
        htmlFor={`question-${question.id}`}
        className="text-paper-100 mb-2 block text-sm font-semibold"
      >
        {question.label}
        {question.required ? <span className="text-accent-400"> *</span> : null}
      </label>
      {question.helpText ? (
        <Markdown className="mb-3">{question.helpText}</Markdown>
      ) : null}
      <QuestionRenderer
        question={question}
        value={value}
        disabled={disabled}
        onChange={onChange}
      />
    </div>
  );
}

function EmptyPreview() {
  return (
    <p className="text-paper-500 py-10 text-center text-sm">
      Select a question to preview it.
    </p>
  );
}
