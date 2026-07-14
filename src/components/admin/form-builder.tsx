"use client";

import { useMemo, useState } from "react";
import { Button, QuietButton } from "@/components/button";
import { QuestionRenderer } from "@/components/form/question-renderer";
import { Input } from "@/components/input";
import { Markdown } from "@/components/markdown";
import type {
  RuntimeFormConfig,
  RuntimeQuestionConfig,
} from "@/lib/form-config";
import { evaluateFormConditions, type AnswerMap } from "@/lib/scoring";

const inputTypes = [
  "slider",
  "short_text",
  "paragraph",
  "dropdown",
  "multi_select",
  "multiple_choice",
  "integer",
] as const;

const inputTypeLabels: Record<(typeof inputTypes)[number], string> = {
  slider: "Slider",
  short_text: "Short text",
  paragraph: "Paragraph",
  dropdown: "Dropdown",
  multi_select: "Multi-select",
  multiple_choice: "Multiple choice",
  integer: "Number",
};

const optionTypes = new Set<RuntimeQuestionConfig["type"]>([
  "dropdown",
  "multi_select",
  "multiple_choice",
]);

type BuilderProps = { initialForm: RuntimeFormConfig };
type Mutate = (
  payload: Record<string, unknown>,
) => Promise<RuntimeFormConfig | null>;

export function FormBuilder({ initialForm }: BuilderProps) {
  const [form, setForm] = useState(initialForm);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [message, setMessage] = useState("");
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const states = useMemo(
    () => evaluateFormConditions(form, answers),
    [form, answers],
  );

  async function mutate(payload: Record<string, unknown>) {
    setMessage("");
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
      setMessage(body.error ?? "Could not update the draft.");
      return null;
    }
    setForm(body.form);
    setMessage("Draft saved.");
    return body.form;
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
    if (added) setExpandedId(added.id);
    return Boolean(next);
  }

  async function publish() {
    const response = await fetch("/api/admin/form/publish", {
      method: "POST",
    });
    const body = (await response.json()) as {
      error?: string;
      errors?: string[];
    };
    setMessage(
      response.ok
        ? "Draft published. A fresh draft will be created on the next edit."
        : (body.errors?.join(" ") ?? body.error ?? "Publish failed."),
    );
  }

  async function dropBefore(targetId: number) {
    if (draggedId == null || draggedId === targetId) return;
    const ids = form.questions
      .map(({ id }) => id)
      .filter((id) => id !== draggedId);
    ids.splice(ids.indexOf(targetId), 0, draggedId);
    await mutate({ action: "reorder", orderedIds: ids });
    setDraggedId(null);
  }

  function questionList(questions: RuntimeQuestionConfig[]) {
    if (!questions.length) {
      return (
        <p className="text-paper-500 px-4 py-5 text-sm">
          No questions in this section yet.
        </p>
      );
    }
    return questions.map((question) => (
      <QuestionAccordion
        key={question.id}
        question={question}
        form={form}
        expanded={expandedId === question.id}
        onToggle={() =>
          setExpandedId((current) =>
            current === question.id ? null : question.id,
          )
        }
        onDragStart={() => setDraggedId(question.id)}
        onDrop={() => void dropBefore(question.id)}
        mutate={mutate}
      />
    ));
  }

  return (
    <div>
      <header className="page-heading flex max-w-none flex-wrap items-end justify-between gap-5">
        <div>
          <p className="eyebrow">Draft form · version {form.id}</p>
          <h1>Form Builder</h1>
          <p>
            Click a question to edit it in place. New questions are required by
            default.
          </p>
        </div>
        <Button onClick={() => void publish()}>Publish draft</Button>
      </header>
      {message ? (
        <p
          role="status"
          className="panel text-paper-300 mb-5 px-4 py-3 text-sm"
        >
          {message}
        </p>
      ) : null}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(34rem,1.35fr)_minmax(22rem,0.65fr)]">
        <section className="space-y-5">
          <AddQuestion sections={form.sections} onAdd={addQuestion} />
          {form.sections.map((section) => {
            const sectionQuestions = form.questions.filter(
              ({ sectionId }) => sectionId === section.id,
            );
            return (
              <div key={section.id} className="panel overflow-hidden">
                <header className="border-hairline bg-ink-850 border-b px-4 py-3">
                  <h2 className="text-paper-100 font-semibold">
                    {section.title}
                  </h2>
                </header>
                <div className="divide-hairline divide-y">
                  {questionList(sectionQuestions)}
                </div>
              </div>
            );
          })}
          {form.questions.some(({ sectionId }) => sectionId == null) ? (
            <div className="panel overflow-hidden">
              <header className="border-hairline bg-ink-850 border-b px-4 py-3">
                <h2 className="text-paper-100 font-semibold">Unsectioned</h2>
              </header>
              <div className="divide-hairline divide-y">
                {questionList(
                  form.questions.filter(({ sectionId }) => sectionId == null),
                )}
              </div>
            </div>
          ) : null}
        </section>

        <section className="panel p-5 xl:sticky xl:top-6">
          <p className="eyebrow">Live preview</p>
          <div className="mt-5 space-y-5">
            {form.questions.map((question) => {
              const state = states[question.id] ?? {
                visible: true,
                enabled: true,
              };
              if (!state.visible) return null;
              return (
                <div
                  key={question.id}
                  className={state.enabled ? "" : "opacity-45"}
                >
                  <label
                    htmlFor={`question-${question.id}`}
                    className="text-paper-100 mb-2 block text-sm font-semibold"
                  >
                    {question.label}
                    {question.required ? " *" : ""}
                  </label>
                  {question.helpText ? (
                    <Markdown className="mb-3">{question.helpText}</Markdown>
                  ) : null}
                  <QuestionRenderer
                    question={question}
                    value={answers[question.id]}
                    disabled={!state.enabled}
                    onChange={(value) =>
                      setAnswers((current) => ({
                        ...current,
                        [question.id]: value,
                      }))
                    }
                  />
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

function QuestionAccordion({
  question,
  form,
  expanded,
  onToggle,
  onDragStart,
  onDrop,
  mutate,
}: {
  question: RuntimeQuestionConfig;
  form: RuntimeFormConfig;
  expanded: boolean;
  onToggle: () => void;
  onDragStart: () => void;
  onDrop: () => void;
  mutate: Mutate;
}) {
  return (
    <div
      draggable={!expanded}
      onDragStart={onDragStart}
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDrop}
    >
      <button
        type="button"
        aria-expanded={expanded}
        onClick={onToggle}
        className={`hover:bg-ink-850 block w-full px-4 py-4 text-left transition-colors ${expanded ? "bg-ink-850" : ""}`}
      >
        <span className="flex items-start justify-between gap-3">
          <span>
            <span className="text-paper-100 font-medium">{question.label}</span>
            {question.helpText ? (
              <span className="text-paper-500 mt-1 line-clamp-1 block text-xs">
                Has description
              </span>
            ) : null}
          </span>
          <span className="text-paper-500 flex items-center gap-3 text-xs">
            {!expanded ? (
              <span className="hidden sm:inline">Drag to reorder</span>
            ) : null}
            <span
              aria-hidden="true"
              className={`text-lg transition-transform ${expanded ? "rotate-180" : ""}`}
            >
              ⌄
            </span>
          </span>
        </span>
        <span className="text-paper-500 mt-2 flex flex-wrap gap-2 text-[0.65rem] tracking-wide uppercase">
          <Badge>{inputTypeLabels[question.type]}</Badge>
          <Badge>{question.required ? "required" : "optional"}</Badge>
          {question.scored ? (
            <Badge>overall · {question.weight ?? "no weight"}</Badge>
          ) : null}
          {question.secondaryScored ? (
            <Badge>secondary · {question.secondaryWeight ?? "no weight"}</Badge>
          ) : null}
          {question.conditions.length ? <Badge>conditional</Badge> : null}
          {question.rcaEnabled ? <Badge>RCA</Badge> : null}
        </span>
      </button>
      {expanded ? (
        <div className="border-hairline bg-ink-900 border-t">
          <QuestionEditor
            key={`${question.id}-${question.type}`}
            question={question}
            form={form}
            mutate={mutate}
          />
        </div>
      ) : null}
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-ui border-hairline border px-2 py-1">
      {children}
    </span>
  );
}

function AddQuestion({
  sections,
  onAdd,
}: {
  sections: RuntimeFormConfig["sections"];
  onAdd: (data: {
    key: string;
    label: string;
    type: RuntimeQuestionConfig["type"];
    sectionId: number | null;
  }) => Promise<boolean>;
}) {
  const [label, setLabel] = useState("");
  const [type, setType] = useState<RuntimeQuestionConfig["type"]>("short_text");
  const [sectionId, setSectionId] = useState(sections[0]?.id ?? 0);

  async function add(event: React.FormEvent) {
    event.preventDefault();
    const key = label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .replace(/^[^a-z]+/, "q_");
    if (
      await onAdd({
        key,
        label,
        type,
        sectionId: sectionId || null,
      })
    )
      setLabel("");
  }

  return (
    <form
      onSubmit={add}
      className="panel grid gap-3 p-4 sm:grid-cols-[1fr_10rem_10rem_auto]"
    >
      <Input
        value={label}
        onChange={(event) => setLabel(event.target.value)}
        placeholder="New question title"
        required
      />
      <select
        aria-label="Question type"
        className="select-field"
        value={type}
        onChange={(event) =>
          setType(event.target.value as RuntimeQuestionConfig["type"])
        }
      >
        {inputTypes.map((value) => (
          <option key={value} value={value}>
            {inputTypeLabels[value]}
          </option>
        ))}
      </select>
      <select
        aria-label="Question section"
        className="select-field"
        value={sectionId}
        onChange={(event) => setSectionId(Number(event.target.value))}
      >
        {sections.map((section) => (
          <option key={section.id} value={section.id}>
            {section.title}
          </option>
        ))}
      </select>
      <Button type="submit">Add question</Button>
    </form>
  );
}

function QuestionEditor({
  question,
  form,
  mutate,
}: {
  question: RuntimeQuestionConfig;
  form: RuntimeFormConfig;
  mutate: Mutate;
}) {
  const [draft, setDraft] = useState(question);
  const possibleSources = form.questions.filter(
    (candidate) => candidate.sortOrder < question.sortOrder,
  );
  const [sourceId, setSourceId] = useState(possibleSources[0]?.id ?? 0);
  const source = form.questions.find(({ id }) => id === sourceId);
  const [conditionValue, setConditionValue] = useState<number | null>(
    source?.options[0]?.id ?? null,
  );
  const [conditionEffect, setConditionEffect] = useState<"show" | "disable">(
    "show",
  );

  function set<K extends keyof RuntimeQuestionConfig>(
    key: K,
    value: RuntimeQuestionConfig[K],
  ) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const data: Record<string, unknown> = { ...draft };
    for (const key of [
      "id",
      "options",
      "conditions",
      "sortOrder",
      "archivedAt",
    ])
      delete data[key];
    await mutate({
      action: "update_question",
      questionId: question.id,
      data,
    });
  }

  return (
    <div className="p-4 sm:p-5">
      <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
        <Field label="Question title">
          <Input
            value={draft.label}
            onChange={(event) => set("label", event.target.value)}
            required
          />
        </Field>
        <Field label="Answer type">
          <select
            className="select-field"
            value={draft.type}
            onChange={(event) =>
              set("type", event.target.value as RuntimeQuestionConfig["type"])
            }
          >
            {inputTypes.map((value) => (
              <option key={value} value={value}>
                {inputTypeLabels[value]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Description (Markdown supported)" wide>
          <textarea
            className="rounded-ui border-hairline bg-ink-850 text-paper-100 placeholder:text-paper-500 focus:border-accent-400 min-h-28 w-full resize-y border px-3 py-2 text-sm leading-6 focus:outline-none"
            value={draft.helpText}
            onChange={(event) => set("helpText", event.target.value)}
            placeholder="Explain the question or what each option means. Use **bold**, lists, or links."
            maxLength={2000}
          />
        </Field>
        {draft.helpText ? (
          <div className="rounded-ui border-hairline bg-ink-850 border p-3 sm:col-span-2">
            <p className="eyebrow mb-2">Description preview</p>
            <Markdown>{draft.helpText}</Markdown>
          </div>
        ) : null}
        <Field label="Section">
          <select
            className="select-field"
            value={draft.sectionId ?? ""}
            onChange={(event) =>
              set(
                "sectionId",
                event.target.value ? Number(event.target.value) : null,
              )
            }
          >
            <option value="">Unsectioned</option>
            {form.sections.map((section) => (
              <option key={section.id} value={section.id}>
                {section.title}
              </option>
            ))}
          </select>
        </Field>
        <div className="flex items-end pb-2">
          <Check
            label="Required question"
            checked={draft.required}
            onChange={(value) => set("required", value)}
          />
        </div>

        <details className="rounded-ui border-hairline bg-ink-850 border sm:col-span-2">
          <summary className="text-paper-300 cursor-pointer px-4 py-3 text-sm font-semibold">
            Advanced scoring and settings
          </summary>
          <div className="border-hairline grid gap-3 border-t p-4 sm:grid-cols-2">
            <Field label="Stable key" wide>
              <Input
                value={draft.key}
                onChange={(event) => set("key", event.target.value)}
              />
            </Field>
            <NumberField
              label="Minimum"
              value={draft.min}
              onChange={(value) => set("min", value)}
            />
            <NumberField
              label="Maximum"
              value={draft.max}
              onChange={(value) => set("max", value)}
            />
            <NumberField
              label="Overall weight"
              value={draft.weight}
              onChange={(value) => set("weight", value)}
            />
            <NumberField
              label="Overall offset"
              value={draft.offset}
              onChange={(value) => set("offset", value ?? 0)}
            />
            <NumberField
              label="Secondary weight"
              value={draft.secondaryWeight}
              onChange={(value) => set("secondaryWeight", value)}
            />
            <NumberField
              label="Secondary offset"
              value={draft.secondaryOffset}
              onChange={(value) => set("secondaryOffset", value ?? 0)}
            />
            <Field label="Overall blank policy">
              <select
                className="select-field"
                value={draft.blankPolicy}
                onChange={(event) =>
                  set(
                    "blankPolicy",
                    event.target.value as RuntimeQuestionConfig["blankPolicy"],
                  )
                }
              >
                <option value="exclude_and_renormalize">
                  Exclude + renormalize
                </option>
                <option value="treat_as_zero">Treat as zero</option>
              </select>
            </Field>
            <Field label="Secondary blank policy">
              <select
                className="select-field"
                value={draft.secondaryBlankPolicy}
                onChange={(event) =>
                  set(
                    "secondaryBlankPolicy",
                    event.target.value as RuntimeQuestionConfig["blankPolicy"],
                  )
                }
              >
                <option value="exclude_and_renormalize">
                  Exclude + renormalize
                </option>
                <option value="treat_as_zero">Treat as zero</option>
              </select>
            </Field>
            {draft.type === "multi_select" ? (
              <Field label="Multi-select scoring">
                <select
                  className="select-field"
                  value={draft.multiSelectScoring ?? "avg"}
                  onChange={(event) =>
                    set(
                      "multiSelectScoring",
                      event.target.value as "sum" | "avg",
                    )
                  }
                >
                  <option value="avg">Average</option>
                  <option value="sum">Sum</option>
                </select>
              </Field>
            ) : null}
            <div className="text-paper-300 flex flex-wrap gap-4 text-sm sm:col-span-2">
              <Check
                label="Overall scored"
                checked={draft.scored}
                onChange={(value) => set("scored", value)}
              />
              <Check
                label="Secondary scored"
                checked={draft.secondaryScored}
                onChange={(value) => set("secondaryScored", value)}
              />
              <Check
                label="Allow N/A"
                checked={draft.allowNa}
                onChange={(value) => set("allowNa", value)}
              />
              <Check
                label="RCA enabled"
                checked={draft.rcaEnabled}
                onChange={(value) => set("rcaEnabled", value)}
              />
            </div>
          </div>
        </details>

        <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2">
          <QuietButton
            type="button"
            onClick={() =>
              void mutate({
                action: "archive_question",
                questionId: question.id,
              })
            }
          >
            Archive question
          </QuietButton>
          <Button type="submit">Save changes</Button>
        </div>
      </form>

      {optionTypes.has(draft.type) ? (
        <OptionsEditor question={question} mutate={mutate} />
      ) : null}

      <div className="border-hairline mt-7 border-t pt-5">
        <p className="eyebrow">Conditions · {question.conditionLogic}</p>
        {question.conditions.map((condition) => (
          <div
            key={condition.id}
            className="text-paper-300 mt-2 flex justify-between gap-3 text-sm"
          >
            <span>
              {condition.effect} when question {condition.sourceQuestionId}{" "}
              {condition.operator} {String(condition.value)}
            </span>
            <button
              type="button"
              className="link-button"
              onClick={() =>
                void mutate({
                  action: "delete_condition",
                  conditionId: condition.id,
                })
              }
            >
              Remove
            </button>
          </div>
        ))}
        {possibleSources.length ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_8rem_auto]">
            <select
              aria-label="Condition question"
              className="select-field"
              value={sourceId}
              onChange={(event) => {
                const id = Number(event.target.value);
                setSourceId(id);
                setConditionValue(
                  form.questions.find((candidate) => candidate.id === id)
                    ?.options[0]?.id ?? null,
                );
              }}
            >
              {possibleSources.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.label}
                </option>
              ))}
            </select>
            {source?.options.length ? (
              <select
                aria-label="Condition value"
                className="select-field"
                value={conditionValue ?? ""}
                onChange={(event) =>
                  setConditionValue(Number(event.target.value))
                }
              >
                {source.options.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : (
              <Input
                aria-label="Condition value"
                type="number"
                placeholder="Value"
                onChange={(event) =>
                  setConditionValue(Number(event.target.value))
                }
              />
            )}
            <select
              aria-label="Condition effect"
              className="select-field"
              value={conditionEffect}
              onChange={(event) =>
                setConditionEffect(event.target.value as "show" | "disable")
              }
            >
              <option value="show">Show</option>
              <option value="disable">Disable</option>
            </select>
            <QuietButton
              type="button"
              onClick={() =>
                void mutate({
                  action: "add_condition",
                  questionId: question.id,
                  data: {
                    sourceQuestionId: sourceId,
                    operator: "equals",
                    value: conditionValue,
                    effect: conditionEffect,
                  },
                })
              }
            >
              Add
            </QuietButton>
          </div>
        ) : (
          <p className="text-paper-500 mt-2 text-sm">
            Move another question before this one to use it as a condition
            source.
          </p>
        )}
      </div>
    </div>
  );
}

function OptionsEditor({
  question,
  mutate,
}: {
  question: RuntimeQuestionConfig;
  mutate: Mutate;
}) {
  const [optionLabel, setOptionLabel] = useState("");
  const [adding, setAdding] = useState(false);

  async function addOptions(rawLabels: string[]) {
    const labels = rawLabels
      .map((label) => label.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "").trim())
      .filter(Boolean);
    if (!labels.length) return;
    setAdding(true);
    const next = await mutate({
      action: "add_options",
      questionId: question.id,
      labels,
    });
    setAdding(false);
    if (next) setOptionLabel("");
  }

  function handlePaste(event: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData.getData("text");
    const labels = pasted.split(/\r?\n|\t/).filter((value) => value.trim());
    if (labels.length <= 1) return;
    event.preventDefault();
    void addOptions(labels);
  }

  return (
    <div className="border-hairline mt-7 border-t pt-5">
      <p className="eyebrow">Response options</p>
      <p className="text-paper-500 mt-1 text-xs">
        Press Enter or + to add one option. Paste a line-separated list to add
        every option at once.
      </p>
      <div className="mt-3 space-y-2">
        {question.options.map((option) => (
          <OptionEditorRow
            key={option.id}
            questionId={question.id}
            option={option}
            mutate={mutate}
          />
        ))}
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void addOptions([optionLabel]);
        }}
        className="mt-3 flex gap-2"
      >
        <Input
          value={optionLabel}
          onChange={(event) => setOptionLabel(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            if (!adding) void addOptions([optionLabel]);
          }}
          onPaste={handlePaste}
          placeholder="Type or paste response options"
          required
        />
        <Button
          type="submit"
          className="w-11 px-0 text-xl"
          aria-label="Add response option"
          disabled={adding}
        >
          +
        </Button>
      </form>
    </div>
  );
}

function Field({
  label,
  wide = false,
  children,
}: {
  label: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={`text-paper-500 text-xs ${wide ? "sm:col-span-2" : ""}`}>
      {label}
      <span className="mt-1 block">{children}</span>
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  return (
    <Field label={label}>
      <Input
        type="number"
        step="any"
        value={value ?? ""}
        onChange={(event) =>
          onChange(
            event.target.value === "" ? null : Number(event.target.value),
          )
        }
      />
    </Field>
  );
}

function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="text-paper-300 flex items-center gap-2 text-xs">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      {label}
    </label>
  );
}

function OptionEditorRow({
  questionId,
  option,
  mutate,
}: {
  questionId: number;
  option: RuntimeQuestionConfig["options"][number];
  mutate: Mutate;
}) {
  const [label, setLabel] = useState(option.label);
  const [score, setScore] = useState(
    option.valueScore == null ? "" : String(option.valueScore),
  );
  const [isNull, setIsNull] = useState(option.isNull);
  return (
    <div className="grid items-center gap-2 sm:grid-cols-[1fr_7rem_auto_auto_auto]">
      <Input
        aria-label={`Label for ${option.label}`}
        value={label}
        onChange={(event) => setLabel(event.target.value)}
      />
      {isNull ? (
        <Badge>N/A · not counted</Badge>
      ) : (
        <Input
          aria-label={`Score for ${option.label}`}
          type="number"
          step="any"
          value={score}
          onChange={(event) => setScore(event.target.value)}
        />
      )}
      <Check
        label="Null"
        checked={isNull}
        onChange={(value) => {
          setIsNull(value);
          if (value) setScore("");
        }}
      />
      <QuietButton
        type="button"
        onClick={() =>
          void mutate({
            action: "save_option",
            questionId,
            optionId: option.id,
            data: {
              label,
              valueScore: isNull || score === "" ? null : Number(score),
              isNull,
              sortOrder: option.sortOrder,
            },
          })
        }
      >
        Save
      </QuietButton>
      <button
        className="link-button"
        type="button"
        onClick={() =>
          void mutate({ action: "archive_option", optionId: option.id })
        }
      >
        Remove
      </button>
    </div>
  );
}
