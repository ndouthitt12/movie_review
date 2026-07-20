"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  RuntimeFormConfig,
  RuntimeQuestionConfig,
} from "@/lib/form-config";

export type SaveStatus = "idle" | "saving" | "saved" | "error";
export type Mutate = (
  payload: Record<string, unknown>,
) => Promise<RuntimeFormConfig | null>;

const editableKeys = [
  "key",
  "label",
  "helpText",
  "type",
  "scaleMinLabel",
  "scaleMaxLabel",
  "sectionId",
  "required",
  "scored",
  "weight",
  "secondaryScored",
  "secondaryWeight",
  "min",
  "max",
  "offset",
  "secondaryOffset",
  "blankPolicy",
  "secondaryBlankPolicy",
  "multiSelectScoring",
  "allowNa",
  "conditionLogic",
  "rcaEnabled",
] as const satisfies readonly (keyof RuntimeQuestionConfig)[];

export type EditableQuestionKey = (typeof editableKeys)[number];
type QuestionDraft = Pick<RuntimeQuestionConfig, EditableQuestionKey>;

function questionData(question: RuntimeQuestionConfig): QuestionDraft {
  return Object.fromEntries(
    editableKeys.map((key) => [key, question[key]]),
  ) as QuestionDraft;
}

function sameDraft(left: QuestionDraft, right: QuestionDraft) {
  return editableKeys.every((key) => left[key] === right[key]);
}

export function useFormDraft(
  initialForm: RuntimeFormConfig,
  onError: (message: string) => void,
) {
  const [form, setFormState] = useState(initialForm);
  const [drafts, setDrafts] = useState<Record<number, QuestionDraft>>({});
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const formRef = useRef(initialForm);
  const draftsRef = useRef(drafts);
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const debounceTimers = useRef(new Map<number, number>());
  const retryTimers = useRef(new Map<number, number>());
  const onErrorRef = useRef(onError);
  const flushRef = useRef<(questionId: number) => Promise<void>>(
    async () => {},
  );

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  const setForm = useCallback((next: RuntimeFormConfig) => {
    formRef.current = next;
    setFormState(next);
  }, []);

  const request = useCallback(
    (payload: Record<string, unknown>) => {
      let resolveResult: (value: RuntimeFormConfig | null) => void;
      const result = new Promise<RuntimeFormConfig | null>((resolve) => {
        resolveResult = resolve;
      });
      queueRef.current = queueRef.current
        .catch(() => undefined)
        .then(async () => {
          try {
            const response = await fetch("/api/admin/form", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(payload),
            });
            const body = (await response.json()) as {
              form?: RuntimeFormConfig;
              error?: string;
            };
            if (!response.ok || !body.form) {
              onErrorRef.current(body.error ?? "Could not update the draft.");
              resolveResult!(null);
              return;
            }
            setForm(body.form);
            resolveResult!(body.form);
          } catch {
            onErrorRef.current("Could not reach the form service.");
            resolveResult!(null);
          }
        });
      return result;
    },
    [setForm],
  );

  const flushQuestion = useCallback(
    async (questionId: number) => {
      const timer = debounceTimers.current.get(questionId);
      if (timer != null) window.clearTimeout(timer);
      debounceTimers.current.delete(questionId);
      const retry = retryTimers.current.get(questionId);
      if (retry != null) window.clearTimeout(retry);
      retryTimers.current.delete(questionId);

      const pending = draftsRef.current[questionId];
      if (!pending) {
        await queueRef.current;
        return;
      }
      const snapshot = { ...pending };
      setSaveStatus("saving");
      const next = await request({
        action: "update_question",
        questionId,
        data: snapshot,
      });
      if (!next) {
        setSaveStatus("error");
        retryTimers.current.set(
          questionId,
          window.setTimeout(() => void flushRef.current(questionId), 2500),
        );
        return;
      }

      if (
        draftsRef.current[questionId] &&
        sameDraft(draftsRef.current[questionId]!, snapshot)
      ) {
        const updated = { ...draftsRef.current };
        delete updated[questionId];
        draftsRef.current = updated;
        setDrafts(updated);
      }
      setSaveStatus("saved");
    },
    [request],
  );

  useEffect(() => {
    flushRef.current = flushQuestion;
  }, [flushQuestion]);

  const updateQuestion = useCallback(
    <K extends EditableQuestionKey>(
      questionId: number,
      key: K,
      value: RuntimeQuestionConfig[K],
      immediate = false,
    ) => {
      const serverQuestion = formRef.current.questions.find(
        ({ id }) => id === questionId,
      );
      if (!serverQuestion) return;
      const next = {
        ...(draftsRef.current[questionId] ?? questionData(serverQuestion)),
        [key]: value,
      } as QuestionDraft;
      const updated = { ...draftsRef.current, [questionId]: next };
      draftsRef.current = updated;
      setDrafts(updated);
      const timer = debounceTimers.current.get(questionId);
      if (timer != null) window.clearTimeout(timer);
      if (immediate) void flushQuestion(questionId);
      else
        debounceTimers.current.set(
          questionId,
          window.setTimeout(() => void flushQuestion(questionId), 600),
        );
    },
    [flushQuestion],
  );

  const mutate = useCallback<Mutate>(
    async (payload) => {
      setSaveStatus("saving");
      const next = await request(payload);
      setSaveStatus(next ? "saved" : "error");
      return next;
    },
    [request],
  );

  const reloadForm = useCallback(async () => {
    await queueRef.current;
    try {
      const response = await fetch("/api/admin/form");
      const body = (await response.json()) as {
        form?: RuntimeFormConfig;
        error?: string;
      };
      if (!response.ok || !body.form) {
        onErrorRef.current(body.error ?? "Could not load the new draft.");
        return null;
      }
      draftsRef.current = {};
      setDrafts({});
      setForm(body.form);
      setSaveStatus("saved");
      return body.form;
    } catch {
      onErrorRef.current("Could not load the new draft.");
      return null;
    }
  }, [setForm]);

  const retry = useCallback(() => {
    for (const questionId of Object.keys(draftsRef.current).map(Number))
      void flushQuestion(questionId);
  }, [flushQuestion]);

  useEffect(() => {
    const currentDebounceTimers = debounceTimers.current;
    const currentRetryTimers = retryTimers.current;
    const beforeUnload = () => {
      for (const [questionId, data] of Object.entries(draftsRef.current)) {
        const body = JSON.stringify({
          action: "update_question",
          questionId: Number(questionId),
          data,
        });
        navigator.sendBeacon(
          "/api/admin/form",
          new Blob([body], { type: "application/json" }),
        );
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      for (const timer of currentDebounceTimers.values())
        window.clearTimeout(timer);
      for (const timer of currentRetryTimers.values())
        window.clearTimeout(timer);
    };
  }, []);

  const mergedForm = useMemo(
    () => ({
      ...form,
      questions: form.questions.map((question) => ({
        ...question,
        ...drafts[question.id],
      })),
    }),
    [drafts, form],
  );

  return {
    form: mergedForm,
    serverForm: form,
    saveStatus,
    updateQuestion,
    flushQuestion,
    mutate,
    reloadForm,
    retry,
  };
}
