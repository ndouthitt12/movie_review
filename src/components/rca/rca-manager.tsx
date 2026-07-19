"use client";

import { useMemo, useState } from "react";
import { Button, QuietButton } from "@/components/button";
import { Input } from "@/components/input";
import { ChevronDownIcon, ChevronUpIcon } from "@/components/ui/icons";
import { rcaPolarities } from "@/db/schema";
import type { RcaTagWithUsage } from "@/lib/rca";

export function RcaManager({
  initialTags,
  questionOptions,
}: {
  initialTags: RcaTagWithUsage[];
  questionOptions: Array<{ key: string; label: string }>;
}) {
  const [tags, setTags] = useState(initialTags);
  const [questionKey, setQuestionKey] = useState(
    questionOptions[0]?.key ?? "overall",
  );
  const labels = useMemo(
    () =>
      Object.fromEntries(questionOptions.map(({ key, label }) => [key, label])),
    [questionOptions],
  );
  const [label, setLabel] = useState("");
  const [polarity, setPolarity] =
    useState<(typeof rcaPolarities)[number]>("positive");
  const [color, setColor] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editPolarity, setEditPolarity] =
    useState<(typeof rcaPolarities)[number]>("neutral");
  const [editColor, setEditColor] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [targetId, setTargetId] = useState("");
  const [message, setMessage] = useState("");
  const [reorderingGroup, setReorderingGroup] = useState<string | null>(null);
  const mergeOptions = useMemo(
    () =>
      tags.filter(
        (tag) =>
          !sourceId ||
          tag.questionKey ===
            tags.find(({ id }) => id === Number(sourceId))?.questionKey,
      ),
    [sourceId, tags],
  );

  async function refresh() {
    const response = await fetch("/api/rca-tags");
    const body = (await response.json()) as { tags: RcaTagWithUsage[] };
    setTags(body.tags);
  }

  async function create(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/rca-tags", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        label,
        questionKey,
        polarity,
        color: color.trim() || null,
      }),
    });
    const body = (await response.json()) as { error?: string };
    if (!response.ok) return setMessage(body.error ?? "Could not create tag.");
    setLabel("");
    setColor("");
    setMessage("Tag created.");
    await refresh();
  }

  function startEditing(tag: RcaTagWithUsage) {
    setEditingId(tag.id);
    setEditLabel(tag.label);
    setEditPolarity(tag.polarity);
    setEditColor(tag.color ?? "");
    setMessage("");
  }

  async function saveEdit(event: React.FormEvent) {
    event.preventDefault();
    if (editingId === null) return;
    const response = await fetch(`/api/rca-tags/${editingId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        label: editLabel,
        polarity: editPolarity,
        color: editColor.trim() || null,
      }),
    });
    const body = (await response.json()) as { error?: string };
    if (!response.ok) return setMessage(body.error ?? "Could not update tag.");
    setEditingId(null);
    setMessage("Tag updated.");
    await refresh();
  }

  async function remove(tag: RcaTagWithUsage) {
    if (
      !window.confirm(
        `Delete “${tag.label}”? It is used by ${tag.usageCount} ${tag.usageCount === 1 ? "film" : "films"}; those assignments will also be removed.`,
      )
    )
      return;
    const response = await fetch(`/api/rca-tags/${tag.id}`, {
      method: "DELETE",
    });
    if (!response.ok) return setMessage("Could not delete tag.");
    setMessage("Tag deleted.");
    await refresh();
  }

  async function merge(event: React.FormEvent) {
    event.preventDefault();
    if (!sourceId || !targetId) return;
    const source = tags.find(({ id }) => id === Number(sourceId));
    const target = tags.find(({ id }) => id === Number(targetId));
    if (!source || !target) return;
    if (
      !window.confirm(
        `Merge “${source.label}” into “${target.label}”? The source tag will be deleted.`,
      )
    )
      return;
    const response = await fetch("/api/rca-tags/merge", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sourceId: source.id, targetId: target.id }),
    });
    const body = (await response.json()) as { error?: string };
    if (!response.ok) return setMessage(body.error ?? "Could not merge tags.");
    setSourceId("");
    setTargetId("");
    setMessage("Tags merged.");
    await refresh();
  }

  async function moveTag(
    groupTags: RcaTagWithUsage[],
    index: number,
    by: -1 | 1,
  ) {
    const targetIndex = index + by;
    if (targetIndex < 0 || targetIndex >= groupTags.length) return;
    const reordered = [...groupTags];
    [reordered[index], reordered[targetIndex]] = [
      reordered[targetIndex]!,
      reordered[index]!,
    ];
    const group = reordered[0]!.questionKey;
    setTags((current) => {
      let nextIndex = 0;
      return current.map((tag) =>
        tag.questionKey === group ? reordered[nextIndex++]! : tag,
      );
    });
    setReorderingGroup(group);
    setMessage("");
    try {
      const response = await fetch("/api/rca-tags/reorder", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderedIds: reordered.map(({ id }) => id) }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        await refresh();
        setMessage(body.error ?? "Could not reorder tags.");
      }
    } catch {
      await refresh();
      setMessage("Could not reorder tags.");
    } finally {
      setReorderingGroup(null);
    }
  }

  return (
    <div className="space-y-10">
      <section className="panel grid gap-7 p-5 lg:grid-cols-2 lg:p-7">
        <form onSubmit={create}>
          <p className="eyebrow">Create tag</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_9rem_8rem_8rem_auto]">
            <Input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Tag label"
              required
            />
            <select
              value={questionKey}
              onChange={(event) => setQuestionKey(event.target.value)}
              className="select-field"
            >
              {questionOptions.map(({ key, label: optionLabel }) => (
                <option key={key} value={key}>
                  {optionLabel}
                </option>
              ))}
            </select>
            <select
              value={polarity}
              onChange={(event) =>
                setPolarity(event.target.value as typeof polarity)
              }
              className="select-field"
            >
              {rcaPolarities.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
            <Input
              aria-label="Optional tag color"
              value={color}
              onChange={(event) => setColor(event.target.value)}
              placeholder="#e8b451 (optional)"
              pattern="#[0-9a-fA-F]{6}"
            />
            <Button type="submit">Create</Button>
          </div>
        </form>
        <form onSubmit={merge}>
          <p className="eyebrow">Merge tags</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <select
              value={sourceId}
              onChange={(event) => {
                setSourceId(event.target.value);
                setTargetId("");
              }}
              className="select-field"
              aria-label="Source tag"
            >
              <option value="">Source tag</option>
              {tags.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {labels[tag.questionKey] ?? tag.questionKey} · {tag.label}
                </option>
              ))}
            </select>
            <select
              value={targetId}
              onChange={(event) => setTargetId(event.target.value)}
              className="select-field"
              aria-label="Target tag"
              disabled={!sourceId}
            >
              <option value="">Merge into…</option>
              {mergeOptions
                .filter(({ id }) => id !== Number(sourceId))
                .map((tag) => (
                  <option key={tag.id} value={tag.id}>
                    {tag.label}
                  </option>
                ))}
            </select>
            <QuietButton type="submit" disabled={!sourceId || !targetId}>
              Merge
            </QuietButton>
          </div>
        </form>
        {message ? (
          <p className="text-paper-300 text-sm lg:col-span-2" role="status">
            {message}
          </p>
        ) : null}
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        {questionOptions.map(({ key: group, label: groupLabel }) => {
          const groupTags = tags.filter((tag) => tag.questionKey === group);
          return (
            <section key={group} className="panel overflow-hidden">
              <header className="border-hairline bg-ink-850 flex items-center justify-between border-b px-5 py-4">
                <h2 className="type-card-title text-paper-100">{groupLabel}</h2>
                <span className="text-paper-500 text-xs">
                  {groupTags.length} tags
                </span>
              </header>
              <ul className="divide-hairline divide-y">
                {groupTags.map((tag, index) => (
                  <li key={tag.id} className="px-5 py-3">
                    {editingId === tag.id ? (
                      <form
                        onSubmit={saveEdit}
                        className="grid gap-2 sm:grid-cols-[1fr_8rem_8rem_auto_auto]"
                      >
                        <Input
                          aria-label={`Label for ${tag.label}`}
                          value={editLabel}
                          onChange={(event) => setEditLabel(event.target.value)}
                          required
                        />
                        <select
                          aria-label={`Polarity for ${tag.label}`}
                          value={editPolarity}
                          onChange={(event) =>
                            setEditPolarity(
                              event.target.value as typeof editPolarity,
                            )
                          }
                          className="select-field"
                        >
                          {rcaPolarities.map((value) => (
                            <option key={value}>{value}</option>
                          ))}
                        </select>
                        <Input
                          aria-label={`Color for ${tag.label}`}
                          value={editColor}
                          onChange={(event) => setEditColor(event.target.value)}
                          placeholder="No color"
                          pattern="#[0-9a-fA-F]{6}"
                        />
                        <Button type="submit" className="px-3 text-xs">
                          Save
                        </Button>
                        <QuietButton
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="px-3 text-xs"
                        >
                          Cancel
                        </QuietButton>
                      </form>
                    ) : (
                      <div className="flex items-center gap-3">
                        <span
                          className={`status-dot ${tag.polarity}`}
                          style={
                            tag.color
                              ? { backgroundColor: tag.color }
                              : undefined
                          }
                        />
                        <span className="text-paper-100 min-w-0 flex-1 truncate text-sm">
                          {tag.label}
                        </span>
                        <span className="text-paper-500 text-xs capitalize">
                          {tag.polarity}
                        </span>
                        <span className="text-paper-500 text-xs tabular-nums">
                          {tag.usageCount} uses
                        </span>
                        <button
                          type="button"
                          onClick={() => startEditing(tag)}
                          aria-label={`Edit ${tag.label}`}
                          className="link-button"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void remove(tag)}
                          aria-label={`Delete ${tag.label}`}
                          className="text-accent-300 hover:text-accent-200 text-xs"
                        >
                          Delete
                        </button>
                        <span className="ml-1 flex shrink-0 items-center gap-0.5">
                          <button
                            type="button"
                            onClick={() => void moveTag(groupTags, index, -1)}
                            aria-label={`Move ${tag.label} up`}
                            title={`Move ${tag.label} up`}
                            disabled={index === 0 || reorderingGroup === group}
                            className="rounded-ui text-paper-500 hover:bg-ink-800 hover:text-paper-100 inline-flex h-7 w-7 items-center justify-center transition-colors disabled:cursor-not-allowed disabled:opacity-25"
                          >
                            <ChevronUpIcon className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void moveTag(groupTags, index, 1)}
                            aria-label={`Move ${tag.label} down`}
                            title={`Move ${tag.label} down`}
                            disabled={
                              index === groupTags.length - 1 ||
                              reorderingGroup === group
                            }
                            className="rounded-ui text-paper-500 hover:bg-ink-800 hover:text-paper-100 inline-flex h-7 w-7 items-center justify-center transition-colors disabled:cursor-not-allowed disabled:opacity-25"
                          >
                            <ChevronDownIcon className="h-4 w-4" />
                          </button>
                        </span>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
