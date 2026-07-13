"use client";

import { useMemo, useState } from "react";
import { Button, QuietButton } from "@/components/button";
import { Input } from "@/components/input";
import { rcaAttributes, rcaPolarities } from "@/db/schema";
import type { RcaTagWithUsage } from "@/lib/rca";

const labels = Object.fromEntries(
  rcaAttributes.map((attribute) => [
    attribute,
    attribute === "genre_fit"
      ? "Genre fit"
      : attribute[0].toUpperCase() + attribute.slice(1),
  ]),
) as Record<(typeof rcaAttributes)[number], string>;

export function RcaManager({
  initialTags,
}: {
  initialTags: RcaTagWithUsage[];
}) {
  const [tags, setTags] = useState(initialTags);
  const [attribute, setAttribute] =
    useState<(typeof rcaAttributes)[number]>("story");
  const [label, setLabel] = useState("");
  const [polarity, setPolarity] =
    useState<(typeof rcaPolarities)[number]>("positive");
  const [sourceId, setSourceId] = useState("");
  const [targetId, setTargetId] = useState("");
  const [message, setMessage] = useState("");
  const mergeOptions = useMemo(
    () =>
      tags.filter(
        (tag) =>
          !sourceId ||
          tag.attribute ===
            tags.find(({ id }) => id === Number(sourceId))?.attribute,
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
      body: JSON.stringify({ label, attribute, polarity, color: null }),
    });
    const body = (await response.json()) as { error?: string };
    if (!response.ok) return setMessage(body.error ?? "Could not create tag.");
    setLabel("");
    setMessage("Tag created.");
    await refresh();
  }

  async function rename(tag: RcaTagWithUsage) {
    const next = window.prompt("Rename tag", tag.label)?.trim();
    if (!next || next === tag.label) return;
    const response = await fetch(`/api/rca-tags/${tag.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ label: next }),
    });
    const body = (await response.json()) as { error?: string };
    if (!response.ok) return setMessage(body.error ?? "Could not rename tag.");
    setMessage("Tag renamed.");
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

  return (
    <div className="space-y-10">
      <section className="panel grid gap-7 p-5 lg:grid-cols-2 lg:p-7">
        <form onSubmit={create}>
          <p className="eyebrow">Create tag</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_10rem_9rem_auto]">
            <Input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Tag label"
              required
            />
            <select
              value={attribute}
              onChange={(event) =>
                setAttribute(event.target.value as typeof attribute)
              }
              className="select-field"
            >
              {rcaAttributes.map((value) => (
                <option key={value} value={value}>
                  {labels[value]}
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
                  {labels[tag.attribute]} · {tag.label}
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
        {rcaAttributes.map((group) => {
          const groupTags = tags.filter((tag) => tag.attribute === group);
          return (
            <section key={group} className="panel overflow-hidden">
              <header className="border-hairline bg-ink-850 flex items-center justify-between border-b px-5 py-4">
                <h2 className="text-paper-100 font-semibold">
                  {labels[group]}
                </h2>
                <span className="text-paper-500 text-xs">
                  {groupTags.length} tags
                </span>
              </header>
              <ul className="divide-hairline divide-y">
                {groupTags.map((tag) => (
                  <li
                    key={tag.id}
                    className="flex items-center gap-3 px-5 py-3"
                  >
                    <span className={`status-dot ${tag.polarity}`} />
                    <span className="text-paper-100 min-w-0 flex-1 truncate text-sm">
                      {tag.label}
                    </span>
                    <span className="text-paper-500 text-xs tabular-nums">
                      {tag.usageCount} uses
                    </span>
                    <button
                      type="button"
                      onClick={() => void rename(tag)}
                      className="link-button"
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      onClick={() => void remove(tag)}
                      className="text-accent-300 hover:text-accent-200 text-xs"
                    >
                      Delete
                    </button>
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
