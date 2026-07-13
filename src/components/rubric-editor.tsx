"use client";

import { useState } from "react";
import { Button, QuietButton } from "@/components/button";

type RubricRow = { score: number; meaning: string; examples: string[] };

export function RubricEditor({ initial }: { initial: RubricRow[] }) {
  const sorted = () =>
    [...initial].sort((left, right) => right.score - left.score);
  const [rows, setRows] = useState(sorted);
  const [savedRows, setSavedRows] = useState(sorted);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  function update(score: number, patch: Partial<RubricRow>) {
    setRows((current) =>
      current.map((row) => (row.score === score ? { ...row, ...patch } : row)),
    );
  }

  async function save() {
    setSaving(true);
    setMessage("");
    const response = await fetch("/api/settings/rubric", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ rubric: rows }),
    });
    const body = (await response.json()) as { error?: string };
    setSaving(false);
    if (!response.ok) setMessage(body.error ?? "Could not save the rubric.");
    else {
      setSavedRows(rows);
      setMessage("Rubric saved.");
      setEditing(false);
    }
  }

  return (
    <section className="panel overflow-hidden">
      <header className="border-hairline flex items-center justify-between gap-4 border-b px-5 py-5 sm:px-7">
        <div>
          <p className="eyebrow">0–10 reference</p>
          <h2 className="text-paper-100 mt-1 text-2xl font-bold">
            What every score means
          </h2>
        </div>
        {!editing ? (
          <QuietButton onClick={() => setEditing(true)}>Edit scale</QuietButton>
        ) : null}
      </header>
      <div className="divide-hairline divide-y">
        {rows.map((row) => (
          <div
            key={row.score}
            className="grid gap-3 px-5 py-5 sm:grid-cols-[4rem_1fr] sm:px-7"
          >
            <p className="text-accent-300 text-4xl font-bold tabular-nums">
              {row.score}
            </p>
            {editing ? (
              <div className="grid gap-3">
                <label className="text-paper-500 text-xs">
                  Meaning
                  <input
                    value={row.meaning}
                    onChange={(event) =>
                      update(row.score, { meaning: event.target.value })
                    }
                    className="border-hairline bg-ink-900 text-paper-100 rounded-ui mt-1 h-10 w-full border px-3 text-sm"
                  />
                </label>
                <label className="text-paper-500 text-xs">
                  Example films, comma separated
                  <input
                    value={row.examples.join(", ")}
                    onChange={(event) =>
                      update(row.score, {
                        examples: event.target.value
                          .split(",")
                          .map((value) => value.trim())
                          .filter(Boolean),
                      })
                    }
                    className="border-hairline bg-ink-900 text-paper-100 rounded-ui mt-1 h-10 w-full border px-3 text-sm"
                  />
                </label>
              </div>
            ) : (
              <div>
                <p className="text-paper-100 text-lg font-semibold">
                  {row.meaning}
                </p>
                <p className="text-paper-500 mt-2 text-sm italic">
                  {row.examples.length
                    ? row.examples.join(" · ")
                    : "No example films yet"}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
      {editing ? (
        <footer className="border-hairline flex flex-wrap items-center gap-3 border-t px-5 py-5 sm:px-7">
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? "Saving…" : "Save rubric"}
          </Button>
          <QuietButton
            onClick={() => {
              setRows(savedRows);
              setEditing(false);
              setMessage("");
            }}
          >
            Cancel
          </QuietButton>
          {message ? (
            <p role="status" className="text-paper-300 text-sm">
              {message}
            </p>
          ) : null}
        </footer>
      ) : message ? (
        <p
          role="status"
          className="text-positive border-hairline border-t px-5 py-4 text-sm sm:px-7"
        >
          {message}
        </p>
      ) : null}
    </section>
  );
}
