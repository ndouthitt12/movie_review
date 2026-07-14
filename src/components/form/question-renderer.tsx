"use client";

import { Dropdown } from "./dropdown";
import { IntegerInput } from "./integer-input";
import { MultiSelect } from "./multi-select";
import { MultipleChoice } from "./multiple-choice";
import { Paragraph } from "./paragraph";
import { ShortText } from "./short-text";
import { Slider } from "./slider";
import type { RuntimeQuestionConfig } from "@/lib/form-config";
import type { AnswerValue } from "@/lib/scoring";

export function QuestionRenderer({
  question,
  value,
  onChange,
  disabled = false,
}: {
  question: RuntimeQuestionConfig;
  value: AnswerValue | undefined;
  onChange: (value: AnswerValue) => void;
  disabled?: boolean;
}) {
  const inputDisabled = disabled || Boolean(value?.isNa);
  const options = question.options.map(({ id, label, isNull }) => ({
    id,
    label,
    exclusive: isNull,
  }));
  let input: React.ReactNode;

  switch (question.type) {
    case "slider":
      input = (
        <Slider
          id={`question-${question.id}`}
          min={question.min ?? 0}
          max={question.max ?? 100}
          value={value?.number ?? question.min ?? 0}
          disabled={inputDisabled}
          onChange={(number) => onChange({ number, isNa: false })}
        />
      );
      break;
    case "short_text":
      input = (
        <ShortText
          value={value?.text ?? ""}
          disabled={inputDisabled}
          onChange={(event) => onChange({ text: event.target.value })}
        />
      );
      break;
    case "paragraph":
      input = (
        <Paragraph
          value={value?.text ?? ""}
          disabled={inputDisabled}
          onChange={(event) => onChange({ text: event.target.value })}
        />
      );
      break;
    case "dropdown":
      input = (
        <Dropdown
          options={question.options}
          value={value?.optionIds?.[0] ?? null}
          disabled={inputDisabled}
          onChange={(id) => onChange({ optionIds: id == null ? [] : [id] })}
        />
      );
      break;
    case "multi_select":
      input = (
        <MultiSelect
          label={question.label}
          options={options}
          selectedIds={value?.optionIds ?? []}
          disabled={inputDisabled}
          onChange={(optionIds) => onChange({ optionIds })}
        />
      );
      break;
    case "multiple_choice":
      input = (
        <MultipleChoice
          name={`question-${question.id}`}
          options={question.options}
          value={value?.optionIds?.[0] ?? null}
          disabled={inputDisabled}
          onChange={(id) => onChange({ optionIds: [id] })}
        />
      );
      break;
    case "integer":
      input = (
        <IntegerInput
          value={value?.number ?? null}
          min={question.min}
          max={question.max}
          disabled={inputDisabled}
          onChange={(number) => onChange({ number })}
        />
      );
      break;
  }

  return (
    <div>
      {input}
      {question.allowNa &&
      (question.type === "slider" || question.type === "integer") ? (
        <label className="text-paper-500 mt-2 flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={Boolean(value?.isNa)}
            disabled={disabled}
            onChange={(event) =>
              onChange(event.target.checked ? { isNa: true } : {})
            }
          />
          N/A — not counted
        </label>
      ) : null}
    </div>
  );
}
