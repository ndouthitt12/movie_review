"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button, QuietButton } from "@/components/button";
import { RcaChip } from "@/components/rca/rca-chip";
import {
  RcaMultiselect,
  type RcaOption,
} from "@/components/rca/rca-multiselect";
import { dateInTimeZone } from "@/lib/dates";
import {
  computeOverall,
  computeSecondary,
  scoreAttributes,
  type AttributeScores,
  type RatingWeights,
} from "@/lib/scoring";

type InitialRating = AttributeScores & { quality: number | null };
const labels: Record<keyof AttributeScores, string> = {
  story: "Story",
  direction: "Direction",
  writing: "Writing",
  acting: "Acting",
  music: "Music",
  impact: "Impact",
  rewatchability: "Rewatchability",
  genreFit: "Genre fit",
};
const schemaAttribute: Record<keyof AttributeScores, RcaOption["attribute"]> = {
  story: "story",
  direction: "direction",
  writing: "writing",
  acting: "acting",
  music: "music",
  impact: "impact",
  rewatchability: "rewatchability",
  genreFit: "genre_fit",
};

export function RatingEditor({
  filmId,
  status,
  initial,
  weights,
  allRcaTags,
  initialRcaTags,
}: {
  filmId: number;
  status: string;
  initial: InitialRating | null;
  weights: RatingWeights;
  allRcaTags: RcaOption[];
  initialRcaTags: RcaOption[];
}) {
  const router = useRouter();
  const defaultScores = () =>
    initial ??
    (Object.fromEntries(
      scoreAttributes.map((key) => [key, 50]),
    ) as unknown as AttributeScores);
  const [scores, setScores] = useState<AttributeScores>(defaultScores);
  const [quality, setQuality] = useState(initial?.quality ?? 50);
  const [tags, setTags] = useState(allRcaTags);
  const [selectedIds, setSelectedIds] = useState(
    initialRcaTags.map(({ id }) => id),
  );
  const [editing, setEditing] = useState(!initial);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const overall = useMemo(
    () => computeOverall(scores, weights),
    [scores, weights],
  );
  const secondary = useMemo(
    () => computeSecondary(quality, scores.rewatchability, scores.genreFit),
    [quality, scores],
  );

  async function createTag(attribute: RcaOption["attribute"], label: string) {
    const response = await fetch("/api/rca-tags", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        label,
        attribute,
        polarity: "neutral",
        color: null,
      }),
    });
    const body = (await response.json()) as RcaOption & { error?: string };
    if (!response.ok) throw new Error(body.error ?? "Could not create tag.");
    setTags((current) => [...current, body]);
    return body;
  }

  async function save() {
    let promoteToWatched = false;
    if (status === "to_watch")
      promoteToWatched = window.confirm(
        "Move this film to Watched and add a watch dated today?",
      );
    setSaving(true);
    setMessage("");
    const response = await fetch(`/api/films/${filmId}/rating`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...scores,
        quality,
        rcaTagIds: selectedIds,
        promoteToWatched,
        watchedOn: promoteToWatched ? dateInTimeZone() : undefined,
      }),
    });
    const body = (await response.json()) as { error?: string };
    setSaving(false);
    if (!response.ok) setMessage(body.error ?? "Could not save rating.");
    else {
      setMessage("Rating and why tags saved.");
      setEditing(false);
      router.refresh();
    }
  }

  function cancel() {
    setScores(defaultScores());
    setQuality(initial?.quality ?? 50);
    setSelectedIds(initialRcaTags.map(({ id }) => id));
    setEditing(false);
    setMessage("");
  }

  if (!editing && initial) {
    return (
      <section className="panel overflow-hidden">
        <header className="border-hairline bg-ink-850 flex items-end justify-between border-b px-5 py-5 sm:px-7">
          <div>
            <p className="eyebrow">Your rating</p>
            <h2 className="text-paper-100 mt-1 text-2xl font-bold">
              The breakdown
            </h2>
          </div>
          <div className="text-right">
            <p className="text-positive text-3xl font-bold tabular-nums">
              {overall.toFixed(3)}
            </p>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="link-button mt-1"
            >
              Edit rating
            </button>
          </div>
        </header>
        <div className="bg-hairline grid gap-px sm:grid-cols-2 lg:grid-cols-4">
          {scoreAttributes.map((key) => {
            const attribute = schemaAttribute[key];
            const selected = tags.filter(
              (tag) =>
                tag.attribute === attribute && selectedIds.includes(tag.id),
            );
            return (
              <div key={key} className="bg-ink-900 p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-paper-500 text-xs font-semibold tracking-wide uppercase">
                    {labels[key]}
                  </span>
                  <span className="text-paper-100 text-xl font-bold tabular-nums">
                    {scores[key]}
                  </span>
                </div>
                {selected.length ? (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {selected.map((tag) => (
                      <RcaChip key={tag.id} tag={tag} compact />
                    ))}
                  </div>
                ) : (
                  <p className="text-paper-500 mt-3 text-xs">No why tags</p>
                )}
              </div>
            );
          })}
        </div>
        <div className="border-hairline flex flex-wrap items-center gap-2 border-t px-5 py-4 sm:px-7">
          <span className="text-paper-500 mr-2 text-xs font-semibold tracking-wide uppercase">
            Overall
          </span>
          {tags
            .filter(
              (tag) =>
                tag.attribute === "overall" && selectedIds.includes(tag.id),
            )
            .map((tag) => (
              <RcaChip key={tag.id} tag={tag} />
            ))}
          {!selectedIds.some(
            (id) => tags.find((tag) => tag.id === id)?.attribute === "overall",
          ) ? (
            <span className="text-paper-500 text-xs">No overall why tags</span>
          ) : null}
          {message ? (
            <p className="text-positive ml-auto text-xs" role="status">
              {message}
            </p>
          ) : null}
        </div>
      </section>
    );
  }

  return (
    <section className="panel overflow-hidden">
      <header className="border-hairline bg-ink-850 flex flex-col gap-4 border-b px-5 py-5 sm:flex-row sm:items-end sm:justify-between sm:px-7">
        <div>
          <p className="eyebrow">Weighted rating</p>
          <h2 className="text-paper-100 mt-1 text-2xl font-bold">
            Rate every part
          </h2>
        </div>
        <div className="flex gap-7 sm:text-right">
          <div>
            <p className="text-paper-500 text-[10px] font-semibold uppercase">
              Secondary
            </p>
            <p className="text-sky text-xl font-bold tabular-nums">
              {secondary.toFixed(3)}
            </p>
          </div>
          <div>
            <p className="text-paper-500 text-[10px] font-semibold uppercase">
              Live overall
            </p>
            <p className="text-positive text-3xl font-bold tabular-nums">
              {overall.toFixed(3)}
            </p>
          </div>
        </div>
      </header>
      <div className="divide-hairline divide-y">
        {scoreAttributes.map((key) => {
          const attribute = schemaAttribute[key];
          const scopedTags = tags.filter((tag) => tag.attribute === attribute);
          const scopedSelected = selectedIds.filter((id) =>
            scopedTags.some((tag) => tag.id === id),
          );
          return (
            <div
              key={key}
              className="grid gap-4 px-5 py-5 sm:px-7 lg:grid-cols-[9rem_minmax(12rem,1fr)_3rem_minmax(15rem,1fr)] lg:items-center"
            >
              <label
                htmlFor={`score-${key}`}
                className="text-paper-100 font-semibold"
              >
                {labels[key]}
              </label>
              <input
                id={`score-${key}`}
                type="range"
                min={0}
                max={100}
                value={scores[key]}
                onChange={(event) =>
                  setScores((current) => ({
                    ...current,
                    [key]: Number(event.target.value),
                  }))
                }
                className="rating-range"
              />
              <output
                htmlFor={`score-${key}`}
                className="text-paper-100 text-right text-lg font-bold tabular-nums"
              >
                {scores[key]}
              </output>
              <RcaMultiselect
                label={`${labels[key]} why tags`}
                options={scopedTags}
                selectedIds={scopedSelected}
                onChange={(nextScoped) =>
                  setSelectedIds((current) => [
                    ...current.filter(
                      (id) => !scopedTags.some((tag) => tag.id === id),
                    ),
                    ...nextScoped,
                  ])
                }
                onCreate={(label) => createTag(attribute, label)}
              />
              <p className="text-paper-500 text-[10px] tabular-nums lg:col-start-2">
                {contribution(key, scores, weights).toFixed(3)} weighted
                contribution
              </p>
            </div>
          );
        })}
      </div>
      <div className="border-hairline bg-ink-850/40 grid gap-4 border-t px-5 py-5 sm:px-7 lg:grid-cols-[9rem_minmax(12rem,1fr)_3rem_minmax(15rem,1fr)] lg:items-center">
        <label htmlFor="quality" className="text-paper-100 font-semibold">
          Quality
        </label>
        <input
          id="quality"
          type="range"
          min={0}
          max={100}
          value={quality}
          onChange={(event) => setQuality(Number(event.target.value))}
          className="rating-range"
        />
        <output
          htmlFor="quality"
          className="text-paper-100 text-right text-lg font-bold tabular-nums"
        >
          {quality}
        </output>
        <RcaMultiselect
          label="Overall why tags"
          options={tags.filter((tag) => tag.attribute === "overall")}
          selectedIds={selectedIds.filter(
            (id) => tags.find((tag) => tag.id === id)?.attribute === "overall",
          )}
          onChange={(nextOverall) =>
            setSelectedIds((current) => [
              ...current.filter(
                (id) =>
                  tags.find((tag) => tag.id === id)?.attribute !== "overall",
              ),
              ...nextOverall,
            ])
          }
          onCreate={(label) => createTag("overall", label)}
          placeholder="Add overall why tags…"
        />
      </div>
      <footer className="border-hairline flex flex-wrap items-center gap-3 border-t px-5 py-5 sm:px-7">
        <Button onClick={() => void save()} disabled={saving}>
          {saving ? "Saving…" : "Save rating"}
        </Button>
        {initial ? <QuietButton onClick={cancel}>Cancel</QuietButton> : null}
        <a href="/dev/tokens" className="link-button ml-1">
          Rating rubric
        </a>
        {message ? (
          <p className="text-paper-300 text-sm" role="status">
            {message}
          </p>
        ) : null}
      </footer>
    </section>
  );
}

function contribution(
  key: keyof AttributeScores,
  scores: AttributeScores,
  weights: RatingWeights,
) {
  const raw =
    key === "rewatchability"
      ? scores[key] + weights.rewatchabilityOffset
      : scores[key];
  return (raw * weights[key]) / weights.divisor;
}
