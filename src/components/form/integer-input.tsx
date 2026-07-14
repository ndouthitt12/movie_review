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
      className="input-field w-full"
    />
  );
}
