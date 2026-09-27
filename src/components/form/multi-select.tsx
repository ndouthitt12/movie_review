"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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
  const rootRef = useRef<HTMLDivElement>(null);

  // Phones have no Escape key, and iOS keeps the input focused when the user
  // taps plain page content. A tap outside the component closes the list.
  useEffect(() => {
    if (!open) return;
    function closeOnOutsideTap(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", closeOnOutsideTap);
    return () => document.removeEventListener("pointerdown", closeOnOutsideTap);
  }, [open]);

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
    <div
      className="relative"
      ref={rootRef}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          setOpen(false);
      }}
    >
      <div className="rounded-ui border-hairline bg-ink-850 focus-within:border-accent-400 flex min-h-10 flex-wrap gap-1.5 border p-1.5 transition-colors">
        {selected.map((option) => (
          <button
            key={option.id}
            type="button"
            disabled={disabled}
            onClick={() => toggle(option)}
            aria-label={`Remove ${option.label}`}
            className="border-accent-500/50 bg-accent-400/10 text-accent-300 rounded-full border px-3 py-1.5 text-sm sm:px-2.5 sm:py-1 sm:text-xs"
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
        <div className="rounded-ui border-hairline bg-ink-900 absolute z-30 mt-1 max-h-64 w-full overflow-y-auto overscroll-contain border p-1 shadow-xl shadow-black/40 sm:max-h-56">
          {filtered.map((option) => (
            <button
              key={option.id}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => toggle(option)}
              className="rounded-ui hover:bg-ink-850 flex min-h-11 w-full items-center gap-2 px-2 py-2 text-left text-sm sm:min-h-0 sm:text-xs"
            >
              <span aria-hidden>
                {selectedIds.includes(option.id) ? "✓" : "○"}
              </span>
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
              className="text-accent-400 hover:bg-ink-850 rounded-ui min-h-11 w-full px-2 py-2 text-left text-sm sm:min-h-0 sm:text-xs"
            >
              {creating ? "Creating…" : `＋ Create “${query.trim()}”`}
            </button>
          ) : null}
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => setOpen(false)}
            className="border-hairline text-paper-300 bg-ink-900 sticky bottom-0 mt-1 min-h-11 w-full border-t px-2 text-center text-sm font-medium sm:hidden"
          >
            Done
          </button>
        </div>
      ) : null}
    </div>
  );
}
