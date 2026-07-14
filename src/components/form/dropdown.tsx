"use client";

export function Dropdown({
  options,
  value,
  disabled,
  onChange,
}: {
  options: Array<{ id: number; label: string }>;
  value: number | null;
  disabled?: boolean;
  onChange: (id: number | null) => void;
}) {
  return (
    <select
      className="select-field w-full"
      value={value ?? ""}
      disabled={disabled}
      onChange={(event) =>
        onChange(event.target.value ? Number(event.target.value) : null)
      }
    >
      <option value="">Choose…</option>
      {options.map((option) => (
        <option key={option.id} value={option.id}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
