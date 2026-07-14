"use client";

import { useMemo, useState } from "react";

export type MultiSelectOption = {
  id: number;
  label: string;
  description?: string;
  exclusive?: boolean;
};

export function MultiSelect({
  label,
  options,
  selectedIds,
  onChange,
  onCreate,
  disabled = false,
  placeholder = "Select options…",
}: {
  label: string;
  options: MultiSelectOption[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
  onCreate?: (label: string) => Promise<MultiSelectOption>;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const filtered = useMemo(
    () =>
      options.filter((option) =>
        option.label.toLowerCase().includes(query.trim().toLowerCase()),
      ),
    [options, query],
  );
  const selected = options.filter((option) => selectedIds.includes(option.id));

  function toggle(option: MultiSelectOption) {
    if (selectedIds.includes(option.id)) {
      onChange(selectedIds.filter((id) => id !== option.id));
    } else if (option.exclusive) {
      onChange([option.id]);
    } else {
      onChange([
        ...selectedIds.filter(
          (id) => !options.find((candidate) => candidate.id === id)?.exclusive,
        ),
        option.id,
      ]);
    }
  }

  async function create() {
    if (!onCreate || !query.trim()) return;
    setCreating(true);
    try {
      const option = await onCreate(query.trim());
      onChange([...selectedIds, option.id]);
      setQuery("");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="relative">
      <div className="border-hairline bg-ink-950 flex min-h-10 flex-wrap gap-1 border p-1.5">
        {selected.map((option) => (
          <button
            key={option.id}
            type="button"
            disabled={disabled}
            onClick={() => toggle(option)}
            className="bg-ink-700 text-paper-100 rounded-ui px-2 py-1 text-xs"
          >
            {option.label} ×
          </button>
        ))}
        <input
          aria-label={label}
          value={query}
          disabled={disabled}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") setOpen(false);
            if (event.key === "Enter" && onCreate && query.trim()) {
              event.preventDefault();
              void create();
            }
          }}
          placeholder={selected.length ? "" : placeholder}
          className="text-paper-100 min-w-28 flex-1 bg-transparent px-1 text-sm outline-none"
        />
      </div>
      {open && !disabled ? (
        <div className="border-hairline bg-ink-900 absolute z-30 mt-1 max-h-56 w-full overflow-y-auto border p-1">
          {filtered.map((option) => (
            <button
              key={option.id}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => toggle(option)}
              className="hover:bg-ink-800 flex w-full items-center gap-2 px-2 py-2 text-left text-xs"
            >
              <span aria-hidden>{selectedIds.includes(option.id) ? "✓" : "○"}</span>
              <span className="text-paper-100 flex-1">{option.label}</span>
              {option.description ? (
                <span className="text-paper-500">{option.description}</span>
              ) : null}
            </button>
          ))}
          {onCreate && query.trim() ? (
            <button
              type="button"
              disabled={creating}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => void create()}
              className="text-positive hover:bg-ink-800 w-full px-2 py-2 text-left text-xs"
            >
              {creating ? "Creating…" : `＋ Create “${query.trim()}”`}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
