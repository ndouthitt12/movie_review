"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button, QuietButton } from "@/components/button";
import { Input } from "@/components/input";
import { Markdown } from "@/components/markdown";
import type {
  RuntimeFormConfig,
  RuntimeQuestionConfig,
} from "@/lib/form-config";
import {
  answerTypes,
  displayTypes,
  isDisplayType,
  optionTypes,
  typeLabels,
} from "./constants";
import type { EditableQuestionKey, Mutate } from "./use-form-draft";
import {
  buttonScaleStoredValue,
  formatButtonScaleValue,
} from "@/lib/button-scale";

type Tab = "basics" | "answers" | "scoring" | "logic";

export function QuestionEditor({
  question,
  form,
  updateQuestion,
  flushQuestion,
  mutate,
  onArchive,
}: {
  question: RuntimeQuestionConfig;
  form: RuntimeFormConfig;
  updateQuestion: <K extends EditableQuestionKey>(
    questionId: number,
    key: K,
    value: RuntimeQuestionConfig[K],
    immediate?: boolean,
  ) => void;
  flushQuestion: (questionId: number) => Promise<void>;
  mutate: Mutate;
  onArchive: () => void;
}) {
  const tabs: Tab[] =
    question.type === "divider"
      ? ["logic"]
      : question.type === "title"
        ? ["basics", "logic"]
        : ["basics", "answers", "scoring", "logic"];
  const [tab, setTab] = useState<Tab>(tabs[0]);

  function change<K extends EditableQuestionKey>(
    key: K,
    value: RuntimeQuestionConfig[K],
    immediate = false,
  ) {
    updateQuestion(question.id, key, value, immediate);
  }

  async function switchTab(next: Tab) {
    await flushQuestion(question.id);
    setTab(next);
  }

  return (
    <section className="panel min-w-0 overflow-hidden">
      <header className="border-hairline flex items-start justify-between gap-4 border-b px-5 py-4">
        <div className="min-w-0">
          <p className="eyebrow">
            Selected {isDisplayType(question.type) ? "element" : "question"}
          </p>
          <h2 className="type-card-title text-paper-100 mt-1 truncate">
            {question.label}
          </h2>
        </div>
        <button
          type="button"
          className="rounded-ui border border-red-500/40 px-3 py-2 text-xs font-semibold text-red-300 hover:bg-red-950/60"
          onClick={onArchive}
        >
          Archive
        </button>
      </header>

      <div
        className="border-hairline flex overflow-x-auto border-b px-3"
        role="tablist"
      >
        {tabs.map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => void switchTab(value)}
            className={`border-b-2 px-3 py-3 text-xs font-semibold capitalize transition-colors ${
              tab === value
                ? "border-accent-400 text-paper-100"
                : "text-paper-500 hover:text-paper-300 border-transparent"
            }`}
          >
            {value}
            {value === "logic" && question.conditions.length ? (
              <span className="bg-accent-400 text-ink-950 ml-2 rounded-full px-1.5 py-0.5 text-[10px]">
                {question.conditions.length}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      <div className="p-5">
        {tab === "basics" ? (
          <BasicsTab
            question={question}
            form={form}
            change={change}
            flush={() => void flushQuestion(question.id)}
          />
        ) : null}
        {tab === "answers" ? (
          <AnswersTab
            question={question}
            change={change}
            flush={() => void flushQuestion(question.id)}
            mutate={mutate}
          />
        ) : null}
        {tab === "scoring" ? (
          <ScoringTab
            question={question}
            form={form}
            change={change}
            flush={() => void flushQuestion(question.id)}
          />
        ) : null}
        {tab === "logic" ? (
          <LogicTab question={question} form={form} mutate={mutate} />
        ) : null}
      </div>
    </section>
  );
}

function BasicsTab({
  question,
  form,
  change,
  flush,
}: {
  question: RuntimeQuestionConfig;
  form: RuntimeFormConfig;
  change: <K extends EditableQuestionKey>(
    key: K,
    value: RuntimeQuestionConfig[K],
    immediate?: boolean,
  ) => void;
  flush: () => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field
        label={question.type === "title" ? "Title text" : "Question title"}
      >
        <Input
          value={question.label}
          onChange={(event) => change("label", event.target.value)}
          onBlur={flush}
          required
        />
      </Field>
      {question.type !== "title" ? (
        <Field label="Answer type">
          <QuestionTypeSelect
            value={question.type}
            onChange={(value) => change("type", value, true)}
          />
        </Field>
      ) : null}
      <Field label="Description (Markdown supported)" wide>
        <textarea
          className="rounded-ui border-hairline bg-ink-850 text-paper-100 placeholder:text-paper-500 focus:border-accent-400 min-h-28 w-full resize-y border px-3 py-2 text-sm leading-6 focus:outline-none"
          value={question.helpText}
          onChange={(event) => change("helpText", event.target.value)}
          onBlur={flush}
          placeholder="Explain the question or add supporting copy."
          maxLength={2000}
        />
      </Field>
      {question.helpText ? (
        <div className="rounded-ui border-hairline bg-ink-850 border p-3 sm:col-span-2">
          <p className="eyebrow mb-2">Description preview</p>
          <Markdown>{question.helpText}</Markdown>
        </div>
      ) : null}
      <Field label="Section">
        <select
          className="select-field"
          value={question.sectionId ?? ""}
          onChange={(event) =>
            change(
              "sectionId",
              event.target.value ? Number(event.target.value) : null,
              true,
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
      {question.type !== "title" ? (
        <div className="flex items-end pb-2">
          <Check
            label="Required question"
            checked={question.required}
            onChange={(value) => change("required", value, true)}
          />
        </div>
      ) : null}
      <Field label="Stable key" wide>
        <Input
          value={question.key}
          onChange={(event) => change("key", event.target.value)}
          onBlur={flush}
        />
      </Field>
    </div>
  );
}

function QuestionTypeSelect({
  value,
  onChange,
}: {
  value: RuntimeQuestionConfig["type"];
  onChange: (value: RuntimeQuestionConfig["type"]) => void;
}) {
  return (
    <select
      className="select-field"
      value={value}
      onChange={(event) =>
        onChange(event.target.value as RuntimeQuestionConfig["type"])
      }
    >
      <optgroup label="Answer fields">
        {answerTypes.map((type) => (
          <option key={type} value={type}>
            {typeLabels[type]}
          </option>
        ))}
      </optgroup>
      <optgroup label="Layout">
        {displayTypes.map((type) => (
          <option key={type} value={type}>
            {typeLabels[type]}
          </option>
        ))}
      </optgroup>
    </select>
  );
}

function AnswersTab({
  question,
  change,
  flush,
  mutate,
}: {
  question: RuntimeQuestionConfig;
  change: <K extends EditableQuestionKey>(
    key: K,
    value: RuntimeQuestionConfig[K],
    immediate?: boolean,
  ) => void;
  flush: () => void;
  mutate: Mutate;
}) {
  if (optionTypes.has(question.type))
    return <OptionsEditor question={question} mutate={mutate} />;

  if (question.type === "button_scale")
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Minimum label">
          <Input
            value={question.scaleMinLabel}
            maxLength={100}
            onChange={(event) => change("scaleMinLabel", event.target.value)}
            onBlur={flush}
          />
        </Field>
        <Field label="Maximum label">
          <Input
            value={question.scaleMaxLabel}
            maxLength={100}
            onChange={(event) => change("scaleMaxLabel", event.target.value)}
            onBlur={flush}
          />
        </Field>
        <p className="text-paper-500 text-xs leading-5 sm:col-span-2">
          The scale displays 1–10 with half points and stores 10–100 for
          compatibility with existing scoring.
        </p>
      </div>
    );

  if (question.type === "slider" || question.type === "integer")
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <NumberField
          label="Minimum"
          value={question.min}
          onChange={(value) => change("min", value)}
          onBlur={flush}
        />
        <NumberField
          label="Maximum"
          value={question.max}
          onChange={(value) => change("max", value)}
          onBlur={flush}
        />
        <p className="text-paper-500 text-xs leading-5 sm:col-span-2">
          These bounds define the answer range shown to the person rating a
          film.
        </p>
      </div>
    );

  return (
    <EmptyTab>
      {typeLabels[question.type]} questions do not have configurable answer
      options.
    </EmptyTab>
  );
}

function ScoringTab({
  question,
  form,
  change,
  flush,
}: {
  question: RuntimeQuestionConfig;
  form: RuntimeFormConfig;
  change: <K extends EditableQuestionKey>(
    key: K,
    value: RuntimeQuestionConfig[K],
    immediate?: boolean,
  ) => void;
  flush: () => void;
}) {
  const overallTotal = form.questions
    .filter((candidate) => candidate.scored && !isDisplayType(candidate.type))
    .reduce((total, candidate) => total + (candidate.weight ?? 0), 0);
  const secondaryTotal = form.questions
    .filter(
      (candidate) =>
        candidate.secondaryScored && !isDisplayType(candidate.type),
    )
    .reduce((total, candidate) => total + (candidate.secondaryWeight ?? 0), 0);

  return (
    <div className="space-y-6">
      <ScoreGroup
        title="Overall score"
        enabled={question.scored}
        onEnabled={(value) => change("scored", value, true)}
        weight={question.weight}
        onWeight={(value) => change("weight", value)}
        offset={question.offset}
        onOffset={(value) => change("offset", value ?? 0)}
        blankPolicy={question.blankPolicy}
        onBlankPolicy={(value) => change("blankPolicy", value, true)}
        share={weightShare(question.scored, question.weight, overallTotal)}
        flush={flush}
      />
      <ScoreGroup
        title="Secondary score"
        enabled={question.secondaryScored}
        onEnabled={(value) => change("secondaryScored", value, true)}
        weight={question.secondaryWeight}
        onWeight={(value) => change("secondaryWeight", value)}
        offset={question.secondaryOffset}
        onOffset={(value) => change("secondaryOffset", value ?? 0)}
        blankPolicy={question.secondaryBlankPolicy}
        onBlankPolicy={(value) => change("secondaryBlankPolicy", value, true)}
        share={weightShare(
          question.secondaryScored,
          question.secondaryWeight,
          secondaryTotal,
        )}
        flush={flush}
      />

      {question.type === "multi_select" ? (
        <Field label="Multi-select scoring">
          <select
            className="select-field"
            value={question.multiSelectScoring ?? "avg"}
            onChange={(event) =>
              change(
                "multiSelectScoring",
                event.target.value as "sum" | "avg",
                true,
              )
            }
          >
            <option value="avg">Average selected answers</option>
            <option value="sum">Add selected answers</option>
          </select>
          <Helper>How multiple selected answer scores combine.</Helper>
        </Field>
      ) : null}

      <div className="border-hairline grid gap-3 border-t pt-5 sm:grid-cols-2">
        <Check
          label="Allow N/A"
          checked={question.allowNa}
          onChange={(value) => change("allowNa", value, true)}
        />
        <Check
          label="RCA enabled"
          checked={question.rcaEnabled}
          onChange={(value) => change("rcaEnabled", value, true)}
        />
      </div>
    </div>
  );
}

function ScoreGroup({
  title,
  enabled,
  onEnabled,
  weight,
  onWeight,
  offset,
  onOffset,
  blankPolicy,
  onBlankPolicy,
  share,
  flush,
}: {
  title: string;
  enabled: boolean;
  onEnabled: (value: boolean) => void;
  weight: number | null;
  onWeight: (value: number | null) => void;
  offset: number;
  onOffset: (value: number | null) => void;
  blankPolicy: RuntimeQuestionConfig["blankPolicy"];
  onBlankPolicy: (value: RuntimeQuestionConfig["blankPolicy"]) => void;
  share: string;
  flush: () => void;
}) {
  return (
    <section className="rounded-ui border-hairline bg-ink-850 border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-paper-100 text-sm font-semibold">{title}</h3>
        <Check label="Included" checked={enabled} onChange={onEnabled} />
      </div>
      <p className="text-accent-400 mt-2 text-xs font-semibold">{share}</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <NumberField
          label="Weight"
          value={weight}
          onChange={onWeight}
          onBlur={flush}
          helper="How much this question counts toward the score, relative to other weights."
        />
        <NumberField
          label="Offset"
          value={offset}
          onChange={onOffset}
          onBlur={flush}
          helper="Added to the raw answer before weighting."
        />
        <Field label="Blank policy" wide>
          <select
            className="select-field"
            value={blankPolicy}
            onChange={(event) =>
              onBlankPolicy(
                event.target.value as RuntimeQuestionConfig["blankPolicy"],
              )
            }
          >
            <option value="exclude_and_renormalize">
              Skip it and rebalance other weights
            </option>
            <option value="treat_as_zero">Count it as zero</option>
          </select>
          <Helper>
            What happens when this is left blank: skip it and rebalance the
            other weights, or count it as zero.
          </Helper>
        </Field>
      </div>
    </section>
  );
}

function weightShare(enabled: boolean, weight: number | null, total: number) {
  if (!enabled || weight == null || total === 0) return "—";
  return `≈ ${Math.round((weight / total) * 100)}% of this score`;
}

function LogicTab({
  question,
  form,
  mutate,
}: {
  question: RuntimeQuestionConfig;
  form: RuntimeFormConfig;
  mutate: Mutate;
}) {
  const possibleSources = useMemo(
    () =>
      form.questions.filter(
        (candidate) =>
          candidate.sortOrder < question.sortOrder &&
          !isDisplayType(candidate.type),
      ),
    [form.questions, question.sortOrder],
  );
  const [sourceId, setSourceId] = useState(possibleSources[0]?.id ?? 0);
  const effectiveSourceId = possibleSources.some(({ id }) => id === sourceId)
    ? sourceId
    : (possibleSources[0]?.id ?? 0);
  const source = form.questions.find(({ id }) => id === effectiveSourceId);
  const [conditionValue, setConditionValue] = useState<number | null>(() =>
    defaultConditionValue(source),
  );
  const [effect, setEffect] = useState<"show" | "disable">("show");

  return (
    <div>
      <p className="eyebrow">Conditions · {question.conditionLogic}</p>
      <div className="mt-3 space-y-2">
        {question.conditions.map((condition) => {
          const conditionSource = form.questions.find(
            ({ id }) => id === condition.sourceQuestionId,
          );
          const valueLabel = conditionSource?.options.find(
            ({ id }) => id === condition.value,
          )?.label;
          const formattedValue =
            conditionSource?.type === "button_scale" &&
            typeof condition.value === "number"
              ? formatButtonScaleValue(condition.value)
              : (valueLabel ?? String(condition.value ?? "a value"));
          return (
            <div
              key={condition.id}
              className="rounded-ui border-hairline bg-ink-850 flex items-start justify-between gap-4 border p-3 text-sm"
            >
              <p className="text-paper-300 leading-6">
                <strong className="text-paper-100 capitalize">
                  {condition.effect}
                </strong>{" "}
                this {isDisplayType(question.type) ? "element" : "question"}{" "}
                when <em>{conditionSource?.label ?? "Unknown question"}</em>{" "}
                equals <em>{formattedValue}</em>.
              </p>
              <button
                type="button"
                className="link-button shrink-0"
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
          );
        })}
      </div>

      {possibleSources.length ? (
        <div className="rounded-ui border-hairline mt-5 border p-4">
          <p className="text-paper-300 text-sm font-semibold">
            Add a condition
          </p>
          <div className="mt-3 grid items-center gap-2 sm:grid-cols-[auto_1fr_auto_1fr]">
            <select
              aria-label="Condition effect"
              className="select-field"
              value={effect}
              onChange={(event) =>
                setEffect(event.target.value as "show" | "disable")
              }
            >
              <option value="show">Show</option>
              <option value="disable">Disable</option>
            </select>
            <span className="text-paper-500 text-xs">this question when</span>
            <select
              aria-label="Condition source question"
              className="select-field"
              value={effectiveSourceId}
              onChange={(event) => {
                const id = Number(event.target.value);
                const next = form.questions.find(
                  (candidate) => candidate.id === id,
                );
                setSourceId(id);
                setConditionValue(defaultConditionValue(next));
              }}
            >
              {possibleSources.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.label}
                </option>
              ))}
            </select>
            <span className="text-paper-500 text-xs">equals</span>
            <div className="sm:col-span-3 sm:col-start-2">
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
                  min={source?.type === "button_scale" ? 1 : undefined}
                  max={source?.type === "button_scale" ? 10 : undefined}
                  step={source?.type === "button_scale" ? 0.5 : undefined}
                  value={conditionValue ?? ""}
                  onChange={(event) =>
                    setConditionValue(
                      event.target.value === ""
                        ? null
                        : Number(event.target.value),
                    )
                  }
                />
              )}
            </div>
            <div className="sm:col-span-4 sm:text-right">
              <QuietButton
                type="button"
                disabled={!effectiveSourceId || conditionValue == null}
                onClick={() =>
                  void mutate({
                    action: "add_condition",
                    questionId: question.id,
                    data: {
                      sourceQuestionId: effectiveSourceId,
                      operator: "equals",
                      value:
                        source?.type === "button_scale"
                          ? buttonScaleStoredValue(conditionValue!)
                          : conditionValue,
                      effect,
                    },
                  })
                }
              >
                Add condition
              </QuietButton>
            </div>
          </div>
        </div>
      ) : (
        <EmptyTab>
          Move an answer question above this one to use it as a condition
          source.
        </EmptyTab>
      )}
    </div>
  );
}

function defaultConditionValue(
  question: RuntimeQuestionConfig | undefined,
): number | null {
  if (question?.type === "button_scale") return 1;
  return question?.options[0]?.id ?? null;
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

  return (
    <div>
      <p className="eyebrow">Response options</p>
      <p className="text-paper-500 mt-1 text-xs leading-5">
        Scores and N/A behavior are saved automatically. Paste a line-separated
        list to add several options.
      </p>
      <div className="mt-4 space-y-2">
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
        className="mt-3 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void addOptions([optionLabel]);
        }}
      >
        <Input
          value={optionLabel}
          onChange={(event) => setOptionLabel(event.target.value)}
          onPaste={(event) => {
            const values = event.clipboardData
              .getData("text")
              .split(/\r?\n|\t/)
              .filter((value) => value.trim());
            if (values.length <= 1) return;
            event.preventDefault();
            void addOptions(values);
          }}
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
  const timer = useRef<number | null>(null);

  function save(nextLabel = label, nextScore = score, nextNull = isNull) {
    if (timer.current != null) window.clearTimeout(timer.current);
    return mutate({
      action: "save_option",
      questionId,
      optionId: option.id,
      data: {
        label: nextLabel,
        valueScore: nextNull || nextScore === "" ? null : Number(nextScore),
        isNull: nextNull,
        sortOrder: option.sortOrder,
      },
    });
  }

  function debounce(nextLabel = label, nextScore = score, nextNull = isNull) {
    if (timer.current != null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(
      () => void save(nextLabel, nextScore, nextNull),
      600,
    );
  }

  useEffect(
    () => () => {
      if (timer.current != null) window.clearTimeout(timer.current);
    },
    [],
  );

  return (
    <div className="rounded-ui border-hairline grid items-center gap-2 border p-2 sm:grid-cols-[1fr_7rem_auto_auto]">
      <Input
        aria-label={`Label for ${option.label}`}
        value={label}
        onChange={(event) => {
          setLabel(event.target.value);
          debounce(event.target.value, score, isNull);
        }}
        onBlur={() => void save()}
      />
      {isNull ? (
        <span className="text-paper-500 text-xs">N/A · not counted</span>
      ) : (
        <Input
          aria-label={`Score for ${option.label}`}
          type="number"
          step="any"
          value={score}
          onChange={(event) => {
            setScore(event.target.value);
            debounce(label, event.target.value, isNull);
          }}
          onBlur={() => void save()}
        />
      )}
      <Check
        label="N/A"
        checked={isNull}
        onChange={(value) => {
          setIsNull(value);
          const nextScore = value ? "" : score;
          if (value) setScore("");
          void save(label, nextScore, value);
        }}
      />
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

function Helper({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-paper-500 mt-1 block text-[11px] leading-4">
      {children}
    </span>
  );
}

function NumberField({
  label,
  value,
  onChange,
  onBlur,
  helper,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  onBlur?: () => void;
  helper?: string;
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
        onBlur={onBlur}
      />
      {helper ? <Helper>{helper}</Helper> : null}
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
        className="accent-accent-400 h-4 w-4"
        onChange={(event) => onChange(event.target.checked)}
      />
      {label}
    </label>
  );
}

function EmptyTab({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-ui border-hairline text-paper-500 border border-dashed px-4 py-8 text-center text-sm">
      {children}
    </p>
  );
}
