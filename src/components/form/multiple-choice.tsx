"use client";

export function MultipleChoice({
  name,
  options,
  value,
  disabled,
  onChange,
}: {
  name: string;
  options: Array<{ id: number; label: string }>;
  value: number | null;
  disabled?: boolean;
  onChange: (id: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <label
          key={option.id}
          className={`rounded-full border px-4 py-2 text-sm transition-colors ${
            value === option.id
              ? "border-accent-400 text-accent-400"
              : "border-hairline bg-ink-850 text-paper-300 hover:border-paper-500 hover:text-paper-100"
          } ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
        >
          <input
            type="radio"
            name={name}
            checked={value === option.id}
            disabled={disabled}
            onChange={() => onChange(option.id)}
            className="sr-only"
          />
          {option.label}
        </label>
      ))}
    </div>
  );
}
