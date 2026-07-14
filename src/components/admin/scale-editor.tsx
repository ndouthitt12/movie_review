"use client";

import { useState } from "react";
import { Button } from "@/components/button";
import { Input } from "@/components/input";

type Level = {
  level: number;
  title: string;
  meaning: string;
  exampleFilms: string;
};

export function ScaleEditor({ initialLevels }: { initialLevels: Level[] }) {
  const [levels, setLevels] = useState(initialLevels);
  const [message, setMessage] = useState("");
  function update(level: number, patch: Partial<Level>) {
    setLevels((current) =>
      current.map((row) => (row.level === level ? { ...row, ...patch } : row)),
    );
  }
  async function save() {
    const response = await fetch("/api/admin/scale", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ levels }),
    });
    const body = (await response.json()) as { error?: string };
    setMessage(
      response.ok
        ? "Rating scale saved."
        : (body.error ?? "Could not save the rating scale."),
    );
  }
  return (
    <section className="panel overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[850px] text-left text-sm">
          <thead className="bg-ink-850 text-paper-500 text-xs">
            <tr>
              <th className="px-4 py-3">Level</th>
              <th>Title</th>
              <th>Meaning</th>
              <th className="pr-4">Example films</th>
            </tr>
          </thead>
          <tbody className="divide-hairline divide-y">
            {[...levels]
              .sort((a, b) => b.level - a.level)
              .map((row) => (
                <tr key={row.level}>
                  <td className="text-accent-400 px-4 py-3 text-2xl font-bold">
                    {row.level}
                  </td>
                  <td className="py-3 pr-3">
                    <Input
                      value={row.title}
                      onChange={(event) =>
                        update(row.level, { title: event.target.value })
                      }
                    />
                  </td>
                  <td className="py-3 pr-3">
                    <Input
                      value={row.meaning}
                      onChange={(event) =>
                        update(row.level, { meaning: event.target.value })
                      }
                    />
                  </td>
                  <td className="py-3 pr-4">
                    <Input
                      value={row.exampleFilms}
                      onChange={(event) =>
                        update(row.level, { exampleFilms: event.target.value })
                      }
                    />
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <footer className="border-hairline flex items-center gap-4 border-t p-4">
        <Button onClick={() => void save()}>Save scale</Button>
        {message ? (
          <p role="status" className="text-paper-300 text-sm">
            {message}
          </p>
        ) : null}
      </footer>
    </section>
  );
}
