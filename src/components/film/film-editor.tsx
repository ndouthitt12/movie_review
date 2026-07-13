"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/button";

export function FilmEditor({
  filmId,
  status,
  notes,
}: {
  filmId: number;
  status: string;
  notes: string;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const response = await fetch(`/api/films/${filmId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        status: data.get("status"),
        notes: data.get("notes"),
      }),
    });
    const body = (await response.json()) as { error?: string };
    setMessage(
      response.ok
        ? "Film details saved."
        : (body.error ?? "Could not save details."),
    );
    if (response.ok) router.refresh();
  }
  return (
    <form onSubmit={submit} className="border-hairline border-t pt-10">
      <h2 className="text-paper-100 font-serif text-3xl">Library notes</h2>
      <div className="mt-5 grid gap-5 md:grid-cols-[14rem_1fr]">
        <label className="text-paper-500 text-xs tracking-widest uppercase">
          Status
          <select
            name="status"
            defaultValue={status}
            className="rounded-ui border-hairline bg-ink-900 text-paper-100 mt-2 block h-10 w-full border px-3 text-sm"
          >
            <option value="watched">Watched</option>
            <option value="to_watch">To Watch</option>
            <option value="to_rewatch">To Re-Watch</option>
          </select>
        </label>
        <label className="text-paper-500 text-xs tracking-widest uppercase">
          Notes
          <textarea
            name="notes"
            defaultValue={notes}
            rows={5}
            className="rounded-ui border-hairline bg-ink-900 text-paper-100 mt-2 block w-full border p-3 text-sm leading-6"
          />
        </label>
      </div>
      <div className="mt-5 flex items-center gap-4">
        <Button type="submit">Save details</Button>
        {message ? (
          <p className="text-paper-500 text-sm" role="status">
            {message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
