"use client";

import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/button";
import { Toast, type ToastMessage } from "@/components/toast";
import type {
  RuntimeFormConfig,
  RuntimeQuestionConfig,
} from "@/lib/form-config";
import { Outline } from "./outline";
import { Preview } from "./preview";
import { QuestionEditor } from "./question-editor";
import { useFormDraft } from "./use-form-draft";
import type { AnswerMap, AnswerValue } from "@/lib/scoring";

export function FormBuilder({
  initialForm,
}: {
  initialForm: RuntimeFormConfig;
}) {
  const [selectedId, setSelectedId] = useState<number | null>(
    initialForm.questions[0]?.id ?? null,
  );
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const toastId = useRef(0);
  const editorRef = useRef<HTMLDivElement>(null);

  const showToast = useCallback(
    (message: string, tone: "success" | "error" = "success") => {
      setToast({ id: ++toastId.current, message, tone });
    },
    [],
  );
  const dismissToast = useCallback(() => setToast(null), []);
  const {
    form,
    saveStatus,
    updateQuestion,
    flushQuestion,
    mutate,
    reloadForm,
    retry,
  } = useFormDraft(initialForm, (message) =>
    showToast(`Couldn’t save — retrying\n${message}`, "error"),
  );
  const selected = form.questions.find(({ id }) => id === selectedId) ?? null;

  async function selectQuestion(id: number) {
    if (selectedId != null && selectedId !== id)
      await flushQuestion(selectedId);
    setSelectedId(id);
    if (window.matchMedia("(max-width: 1279px)").matches)
      window.setTimeout(
        () =>
          editorRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          }),
        0,
      );
  }

  async function addQuestion(data: {
    key: string;
    label: string;
    type: RuntimeQuestionConfig["type"];
    sectionId: number | null;
  }) {
    const existingIds = new Set(form.questions.map(({ id }) => id));
    const next = await mutate({ action: "add_question", data });
    const added = next?.questions.find(({ id }) => !existingIds.has(id));
    if (added) {
      setSelectedId(added.id);
      if (window.matchMedia("(max-width: 1279px)").matches)
        window.setTimeout(
          () => editorRef.current?.scrollIntoView({ behavior: "smooth" }),
          0,
        );
    }
    return Boolean(next);
  }

  async function archiveQuestion(questionId: number) {
    const selected = form.questions.find(({ id }) => id === questionId);
    if (!selected) return;
    if (
      !window.confirm(
        `Archive “${selected.label}”? It will be removed from the draft.`,
      )
    )
      return;
    await flushQuestion(selected.id);
    const index = form.questions.findIndex(({ id }) => id === selected.id);
    const next = await mutate({
      action: "archive_question",
      questionId: selected.id,
    });
    if (next) {
      const replacement =
        next.questions[Math.min(index, next.questions.length - 1)];
      if (selectedId === selected.id) setSelectedId(replacement?.id ?? null);
      showToast(`Archived “${selected.label}”.`);
    }
  }

  async function publish() {
    if (selectedId != null) await flushQuestion(selectedId);
    if (
      !window.confirm(
        `Publish draft v${form.id} as the live form? Existing ratings keep their original form version.`,
      )
    )
      return;
    try {
      const response = await fetch("/api/admin/form/publish", {
        method: "POST",
      });
      const body = (await response.json()) as {
        error?: string;
        errors?: string[];
      };
      if (!response.ok) {
        showToast(
          body.errors?.join("\n") ?? body.error ?? "Publish failed.",
          "error",
        );
        return;
      }
      const selectedKey = selected?.key;
      const nextDraft = await reloadForm();
      if (nextDraft) {
        const replacement = nextDraft.questions.find(
          ({ key }) => key === selectedKey,
        );
        setSelectedId(replacement?.id ?? nextDraft.questions[0]?.id ?? null);
      }
      showToast("Draft published. A fresh draft is ready for further edits.");
    } catch {
      showToast(
        "Publish failed. Check your connection and try again.",
        "error",
      );
    }
  }

  async function reorderQuestions(
    orderedIds: number[],
    moved: { questionId: number; sectionId: number | null },
  ) {
    await mutate({ action: "reorder", orderedIds, moved });
  }

  async function reorderSections(orderedIds: number[]) {
    await mutate({ action: "reorder_sections", orderedIds });
  }

  function changeAnswer(questionId: number, value: AnswerValue) {
    setAnswers((current) => ({ ...current, [questionId]: value }));
  }

  return (
    <div>
      <header className="page-heading flex max-w-none flex-wrap items-end justify-between gap-5">
        <div>
          <p className="eyebrow">Draft form · version {form.id}</p>
          <h1>Form Builder</h1>
          <p>
            Select a question in the outline, then edit and preview it live.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <SaveStatus status={saveStatus} onRetry={retry} />
          <Button onClick={() => void publish()}>Publish draft</Button>
        </div>
      </header>

      <div className="grid items-start gap-5 xl:grid-cols-[20rem_minmax(0,1fr)] 2xl:grid-cols-[20rem_minmax(28rem,1fr)_minmax(22rem,0.8fr)]">
        <Outline
          form={form}
          selectedId={selectedId}
          onSelect={(id) => void selectQuestion(id)}
          onAddQuestion={addQuestion}
          onReorderQuestions={reorderQuestions}
          onReorderSections={reorderSections}
          onArchiveQuestion={(id) => void archiveQuestion(id)}
          mutate={mutate}
        />

        <div ref={editorRef} className="min-w-0 scroll-mt-5">
          {selected ? (
            <QuestionEditor
              key={selected.id}
              question={selected}
              form={form}
              updateQuestion={updateQuestion}
              flushQuestion={flushQuestion}
              mutate={mutate}
              onArchive={() => void archiveQuestion(selected.id)}
            />
          ) : (
            <section className="panel text-paper-500 flex min-h-64 items-center justify-center p-8 text-center text-sm">
              Select a question to edit.
            </section>
          )}
        </div>

        <div className="min-w-0 xl:col-start-2 2xl:col-start-3 2xl:row-start-1">
          <Preview
            form={form}
            selectedId={selectedId}
            answers={answers}
            onAnswer={changeAnswer}
          />
        </div>
      </div>

      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  );
}

function SaveStatus({
  status,
  onRetry,
}: {
  status: "idle" | "saving" | "saved" | "error";
  onRetry: () => void;
}) {
  if (status === "idle") return null;
  if (status === "error")
    return (
      <button
        type="button"
        className="text-xs text-red-300 underline underline-offset-2"
        onClick={onRetry}
      >
        Couldn’t save — retrying
      </button>
    );
  return (
    <span className="text-paper-500 text-xs" role="status">
      {status === "saving" ? "Saving…" : "Saved"}
    </span>
  );
}
