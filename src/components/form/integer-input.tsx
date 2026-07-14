"use client";

export function IntegerInput({
  value,
  min,
  max,
  disabled,
  onChange,
}: {
  value: number | null;
  min: number | null;
  max: number | null;
  disabled?: boolean;
  onChange: (value: number | null) => void;
}) {
  return (
    <input
      type="number"
      step={1}
      min={min ?? undefined}
      max={max ?? undefined}
      value={value ?? ""}
      disabled={disabled}
      onChange={(event) =>
        onChange(event.target.value === "" ? null : Number(event.target.value))
      }
      className="rounded-ui border-hairline bg-ink-850 text-paper-100 hover:border-paper-500 focus:border-accent-400 h-10 w-full border px-3 text-sm transition-colors focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
    />
  );
}
