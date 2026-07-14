"use client";

export function Slider({
  id,
  value,
  min = 0,
  max = 100,
  disabled,
  onChange,
}: {
  id: string;
  value: number;
  min?: number;
  max?: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <div className="grid grid-cols-[1fr_3rem] items-center gap-4">
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        className="rating-range"
      />
      <output htmlFor={id} className="text-paper-100 text-right tabular-nums">
        {value}
      </output>
    </div>
  );
}
