"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/components/button";
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

export function RatingEditor({
  filmId,
  status,
  initial,
  weights,
}: {
  filmId: number;
  status: string;
  initial: InitialRating | null;
  weights: RatingWeights;
}) {
  const router = useRouter();
  const [scores, setScores] = useState<AttributeScores>(
    () =>
      initial ??
      (Object.fromEntries(
        scoreAttributes.map((key) => [key, 50]),
      ) as unknown as AttributeScores),
  );
  const [quality, setQuality] = useState(initial?.quality ?? 50);
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
        promoteToWatched,
        watchedOn: promoteToWatched ? dateInTimeZone() : undefined,
      }),
    });
    const body = (await response.json()) as { error?: string };
    setSaving(false);
    if (!response.ok) setMessage(body.error ?? "Could not save rating.");
    else {
      setMessage("Rating saved.");
      router.refresh();
    }
  }

  return (
    <section className="border-hairline border-t pt-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-accent-300 text-xs tracking-[0.2em] uppercase">
            Weighted rating
          </p>
          <h2 className="text-paper-100 mt-2 font-serif text-4xl">
            Make the score legible
          </h2>
        </div>
        <div className="text-right">
          <p className="text-paper-500 text-xs uppercase">Live overall</p>
          <p className="text-score-high text-4xl tabular-nums">
            {overall.toFixed(3)}
          </p>
        </div>
      </div>
      <div className="divide-hairline border-hairline mt-8 divide-y border-y">
        {scoreAttributes.map((key) => (
          <div
            key={key}
            className="grid gap-3 py-5 md:grid-cols-[10rem_1fr_4rem_9rem] md:items-center"
          >
            <label
              htmlFor={`score-${key}`}
              className="text-paper-100 font-medium"
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
              className="accent-accent-400"
            />
            <output
              htmlFor={`score-${key}`}
              className="text-paper-100 text-right tabular-nums"
            >
              {scores[key]}
            </output>
            <div className="text-paper-500 text-right text-xs tabular-nums">
              {contribution(key, scores, weights).toFixed(3)} overall
            </div>
            <button
              disabled
              className="text-paper-500 text-left text-xs md:col-start-2"
            >
              RCA annotations arrive in Phase 3
            </button>
          </div>
        ))}
      </div>
      <div className="border-hairline mt-8 grid gap-5 border-b pb-8 md:grid-cols-[10rem_1fr_4rem_9rem] md:items-center">
        <label htmlFor="quality" className="text-paper-100 font-medium">
          Quality
        </label>
        <input
          id="quality"
          type="range"
          min={0}
          max={100}
          value={quality}
          onChange={(event) => setQuality(Number(event.target.value))}
          className="accent-accent-400"
        />
        <output
          htmlFor="quality"
          className="text-paper-100 text-right tabular-nums"
        >
          {quality}
        </output>
        <div className="text-right">
          <p className="text-paper-500 text-xs">Secondary</p>
          <p className="text-score-mid tabular-nums">{secondary.toFixed(3)}</p>
        </div>
      </div>
      <div className="mt-6 flex items-center gap-4">
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save rating"}
        </Button>
        <a
          href="/dev/tokens"
          className="text-paper-500 hover:text-accent-300 text-xs underline underline-offset-4"
        >
          Rating rubric reference
        </a>
        {message ? (
          <p className="text-paper-300 text-sm" role="status">
            {message}
          </p>
        ) : null}
      </div>
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
