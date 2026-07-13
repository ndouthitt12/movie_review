"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { RcaChip } from "@/components/rca/rca-chip";
import type { RcaTagWithUsage } from "@/lib/rca";

export type RcaOption = Omit<RcaTagWithUsage, "usageCount"> & {
  usageCount?: number;
};

export function RcaMultiselect({
  label,
  options,
  selectedIds,
  onChange,
  onCreate,
  placeholder = "Add why tags…",
}: {
  label: string;
  options: RcaOption[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
  onCreate?: (label: string) => Promise<RcaOption>;
  placeholder?: string;
}) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef(new Map<number, HTMLButtonElement>());
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(-1);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const selected = options.filter((tag) => selectedIds.includes(tag.id));
  const filtered = useMemo(
    () =>
      options.filter((tag) =>
        tag.label.toLowerCase().includes(query.trim().toLowerCase()),
      ),
    [options, query],
  );
  const exactMatch = options.some(
    (tag) => tag.label.toLowerCase() === query.trim().toLowerCase(),
  );
  const canCreate = Boolean(onCreate && query.trim() && !exactMatch);
  const itemCount = filtered.length + (canCreate ? 1 : 0);
  const effectiveActive = itemCount
    ? Math.max(0, Math.min(active, itemCount - 1))
    : -1;

  useEffect(() => {
    function close(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  useEffect(() => {
    if (!open || effectiveActive < 0) return;
    optionRefs.current
      .get(effectiveActive)
      ?.scrollIntoView({ block: "nearest" });
  }, [effectiveActive, open]);

  function toggle(idToToggle: number) {
    onChange(
      selectedIds.includes(idToToggle)
        ? selectedIds.filter((value) => value !== idToToggle)
        : [...selectedIds, idToToggle],
    );
    setQuery("");
  }

  async function create() {
    if (!onCreate || !canCreate) return;
    setCreating(true);
    setError("");
    try {
      const tag = await onCreate(query.trim());
      onChange([...selectedIds, tag.id]);
      setQuery("");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not create tag.",
      );
    } finally {
      setCreating(false);
    }
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        setActive(event.key === "ArrowDown" ? 0 : Math.max(itemCount - 1, 0));
      } else {
        setActive((current) => {
          const delta = event.key === "ArrowDown" ? 1 : -1;
          return (
            (current + delta + Math.max(itemCount, 1)) % Math.max(itemCount, 1)
          );
        });
      }
    } else if (event.key === "Enter" && open && itemCount) {
      event.preventDefault();
      if (effectiveActive < filtered.length)
        toggle(filtered[effectiveActive].id);
      else void create();
    } else if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
    } else if (event.key === "Backspace" && !query && selectedIds.length) {
      onChange(selectedIds.slice(0, -1));
    }
  }

  return (
    <div ref={rootRef} className="relative min-w-0">
      <label htmlFor={`${id}-input`} className="sr-only">
        {label}
      </label>
      <div
        className="border-hairline bg-ink-900 focus-within:border-sky flex min-h-10 flex-wrap items-center gap-1.5 rounded border px-2 py-1.5"
        onClick={() => inputRef.current?.focus()}
      >
        {selected.map((tag) => (
          <RcaChip
            key={tag.id}
            tag={tag}
            compact
            onRemove={(idToRemove) =>
              onChange(selectedIds.filter((value) => value !== idToRemove))
            }
          />
        ))}
        <input
          ref={inputRef}
          id={`${id}-input`}
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-listbox`}
          aria-autocomplete="list"
          aria-activedescendant={
            open && itemCount ? `${id}-option-${effectiveActive}` : undefined
          }
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => {
            setOpen(true);
            setActive(-1);
          }}
          onKeyDown={onKeyDown}
          placeholder={selected.length ? "" : placeholder}
          className="text-paper-100 placeholder:text-paper-500 min-w-32 flex-1 bg-transparent text-xs outline-none"
        />
      </div>
      {open ? (
        <div
          id={`${id}-listbox`}
          role="listbox"
          aria-multiselectable="true"
          className="border-hairline bg-ink-850 absolute z-40 mt-1 max-h-64 w-full min-w-64 overflow-auto rounded border p-1 shadow-2xl"
        >
          {filtered.map((tag, index) => (
            <button
              ref={(node) => {
                if (node) optionRefs.current.set(index, node);
                else optionRefs.current.delete(index);
              }}
              type="button"
              role="option"
              aria-selected={selectedIds.includes(tag.id)}
              id={`${id}-option-${index}`}
              key={tag.id}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => toggle(tag.id)}
              onMouseEnter={() => setActive(index)}
              className={`flex w-full items-center gap-2 rounded px-2.5 py-2 text-left text-xs ${effectiveActive === index ? "bg-ink-700" : "hover:bg-ink-800"}`}
            >
              <span
                className={`flex h-3.5 w-3.5 items-center justify-center rounded-sm border ${selectedIds.includes(tag.id) ? "border-positive bg-positive text-ink-950" : "border-paper-500"}`}
              >
                {selectedIds.includes(tag.id) ? "✓" : ""}
              </span>
              <span className="text-paper-100 flex-1">{tag.label}</span>
              <span className="text-paper-500 capitalize">{tag.polarity}</span>
            </button>
          ))}
          {canCreate ? (
            <button
              ref={(node) => {
                if (node) optionRefs.current.set(filtered.length, node);
                else optionRefs.current.delete(filtered.length);
              }}
              type="button"
              role="option"
              aria-selected="false"
              id={`${id}-option-${filtered.length}`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => void create()}
              onMouseEnter={() => setActive(filtered.length)}
              disabled={creating}
              className={`text-positive w-full rounded px-2.5 py-2 text-left text-xs ${effectiveActive === filtered.length ? "bg-ink-700" : "hover:bg-ink-800"}`}
            >
              ＋ {creating ? "Creating…" : `Create “${query.trim()}”`}
            </button>
          ) : null}
          {!filtered.length && !canCreate ? (
            <p className="text-paper-500 px-2.5 py-3 text-xs">
              No matching tags.
            </p>
          ) : null}
          {error ? (
            <p className="text-accent-300 px-2.5 py-2 text-xs" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
