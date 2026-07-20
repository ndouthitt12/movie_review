"use client";

import { useId, useRef } from "react";
import { Markdown } from "@/components/markdown";
import {
  BUTTON_SCALE_MAX,
  BUTTON_SCALE_MIN,
  BUTTON_SCALE_STEP,
  buttonScaleDisplayValue,
  buttonScaleStoredValue,
  formatButtonScaleValue,
  isButtonScaleStoredValue,
} from "@/lib/button-scale";

const ACTIVATION_WINDOW_MS = 350;
const BUTTONS = Array.from({ length: 10 }, (_, index) => index + 1);

export function ButtonScale({
  id,
  label,
  description,
  required,
  minLabel,
  maxLabel,
  value,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  description: string;
  required: boolean;
  minLabel: string;
  maxLabel: string;
  value: number | null;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  const generatedId = useId();
  const labelId = `${generatedId}-label`;
  const lastActivation = useRef<{ button: number; at: number } | null>(null);
  const validValue =
    value != null && isButtonScaleStoredValue(value) ? value : null;
  const selectedButton =
    validValue == null ? null : Math.floor(buttonScaleDisplayValue(validValue));

  function activate(button: number, timestamp: number) {
    if (disabled) return;
    const repeated =
      lastActivation.current?.button === button &&
      timestamp - lastActivation.current.at <= ACTIVATION_WINDOW_MS;
    if (repeated) {
      lastActivation.current = null;
      onChange(buttonScaleStoredValue(button) + (button < 10 ? 5 : 0));
      return;
    }
    lastActivation.current = { button, at: timestamp };
    onChange(buttonScaleStoredValue(button));
  }

  function step(delta: number) {
    if (disabled) return;
    lastActivation.current = null;
    const initial = delta > 0 ? BUTTON_SCALE_MIN : BUTTON_SCALE_MAX;
    const next =
      validValue == null
        ? initial
        : Math.max(
            BUTTON_SCALE_MIN,
            Math.min(BUTTON_SCALE_MAX, validValue + delta),
          );
    onChange(next);
  }

  return (
    <div
      id={id}
      className="button-scale rounded-ui border-hairline bg-ink-900 border px-4 py-7 sm:px-7 sm:py-8"
      aria-labelledby={labelId}
    >
      <div className="mx-auto max-w-5xl text-center">
        <h3
          id={labelId}
          className="font-serif text-paper-100 text-3xl leading-tight sm:text-4xl"
        >
          {label}
          {required ? <span className="text-accent-400"> *</span> : null}
        </h3>
        {description ? (
          <Markdown className="mt-2 [&_p]:text-center">{description}</Markdown>
        ) : null}

        <div
          className="my-6 flex items-center justify-center gap-3"
          aria-hidden
        >
          <span className="bg-hairline h-px w-20" />
          <span className="bg-accent-400 block h-2 w-2 rotate-45" />
          <span className="bg-hairline h-px w-20" />
        </div>

        <div className="grid grid-cols-5 gap-2.5 lg:grid-cols-10" role="group">
          {BUTTONS.map((button) => {
            const selected = selectedButton === button;
            const buttonLabel =
              selected && validValue != null
                ? formatButtonScaleValue(validValue)
                : String(button);
            const hasHalf = button < 10;
            return (
              <button
                key={button}
                type="button"
                disabled={disabled}
                aria-pressed={selected}
                aria-label={
                  selected
                    ? `${buttonLabel} selected`
                    : hasHalf
                      ? `Rate ${button}; activate twice for ${button}.5`
                      : "Rate 10"
                }
                onClick={(event) => activate(button, event.timeStamp)}
                onKeyDown={(event) => {
                  if (event.key === "ArrowRight" || event.key === "ArrowUp") {
                    event.preventDefault();
                    step(BUTTON_SCALE_STEP);
                  } else if (
                    event.key === "ArrowLeft" ||
                    event.key === "ArrowDown"
                  ) {
                    event.preventDefault();
                    step(-BUTTON_SCALE_STEP);
                  } else if (event.key === "Home") {
                    event.preventDefault();
                    lastActivation.current = null;
                    onChange(BUTTON_SCALE_MIN);
                  } else if (event.key === "End") {
                    event.preventDefault();
                    lastActivation.current = null;
                    onChange(BUTTON_SCALE_MAX);
                  }
                }}
                className={`rounded-ui aspect-[1.05] min-h-12 w-full touch-manipulation border text-xl font-semibold tabular-nums transition-colors sm:text-2xl ${
                  selected
                    ? "border-accent-400 bg-accent-400/15 text-accent-400 shadow-[0_0_24px_rgb(229_190_103_/_0.12)]"
                    : "border-paper-500/50 bg-ink-850 text-paper-100 hover:border-accent-400/70 hover:text-accent-400"
                } disabled:cursor-not-allowed disabled:opacity-50`}
              >
                {buttonLabel}
              </button>
            );
          })}
        </div>

        <p className="text-paper-500 mt-3 text-[10px] tracking-wide uppercase">
          Double-click or double-tap for half points
        </p>
        <output className="sr-only" aria-live="polite">
          {validValue == null
            ? "No rating selected"
            : `Rating ${formatButtonScaleValue(validValue)} selected`}
        </output>

        <div className="mt-5" aria-hidden>
          <div className="border-paper-500/60 relative border-t border-dashed">
            <span className="bg-accent-400 absolute -top-1 left-0 h-2 w-2 rounded-full" />
            <span className="bg-accent-400 absolute -top-1 right-0 h-2 w-2 rounded-full" />
          </div>
          <div className="text-paper-500 mt-4 flex justify-between gap-5 text-sm">
            <span className="min-w-0 text-left">{minLabel}</span>
            <span className="text-accent-300 min-w-0 text-right">
              {maxLabel}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
