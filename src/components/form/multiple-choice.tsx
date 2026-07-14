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
    <div className="flex flex-wrap gap-3">
      {options.map((option) => (
        <label key={option.id} className="text-paper-300 flex gap-2 text-sm">
          <input
            type="radio"
            name={name}
            checked={value === option.id}
            disabled={disabled}
            onChange={() => onChange(option.id)}
          />
          {option.label}
        </label>
      ))}
    </div>
  );
}
