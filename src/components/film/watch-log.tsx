"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, QuietButton } from "@/components/button";
import { Input } from "@/components/input";
import { dateInTimeZone } from "@/lib/dates";

type Watch = { id: number; watchedOn: string; isRewatch: boolean };

export function WatchLog({
  filmId,
  initial,
}: {
  filmId: number;
  initial: Watch[];
}) {
  const router = useRouter();
  const [watches, setWatches] = useState(initial);
  const [message, setMessage] = useState("");
  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const response = await fetch(`/api/films/${filmId}/watches`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        watchedOn: data.get("watchedOn"),
        isRewatch: data.get("isRewatch") === "on",
      }),
    });
    const body = (await response.json()) as Watch & { error?: string };
    if (response.ok) {
      setWatches((current) =>
        [body, ...current].sort((a, b) =>
          b.watchedOn.localeCompare(a.watchedOn),
        ),
      );
      form.reset();
      setMessage("Watch added.");
      router.refresh();
    } else setMessage(body.error ?? "Could not add watch.");
  }
  async function save(watch: Watch) {
    const response = await fetch(`/api/films/${filmId}/watches/${watch.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        watchedOn: watch.watchedOn,
        isRewatch: watch.isRewatch,
      }),
    });
    setMessage(response.ok ? "Watch updated." : "Could not update watch.");
    if (response.ok) router.refresh();
  }
  async function remove(id: number) {
    if (!window.confirm("Delete this watch entry?")) return;
    const response = await fetch(`/api/films/${filmId}/watches/${id}`, {
      method: "DELETE",
    });
    if (response.ok) {
      setWatches((current) => current.filter((watch) => watch.id !== id));
      setMessage("Watch deleted.");
      router.refresh();
    } else setMessage("Could not delete watch.");
  }
  return (
    <section className="border-hairline border-t pt-10">
      <h2 className="text-paper-100 font-serif text-3xl">Watch log</h2>
      <form onSubmit={add} className="mt-5 flex flex-wrap items-end gap-3">
        <label className="text-paper-500 text-xs tracking-widest uppercase">
          Watched on
          <Input
            name="watchedOn"
            type="date"
            required
            defaultValue={dateInTimeZone()}
            className="mt-2"
          />
        </label>
        <label className="text-paper-300 flex h-10 items-center gap-2 text-sm">
          <input
            name="isRewatch"
            type="checkbox"
            className="accent-accent-400"
          />{" "}
          Rewatch
        </label>
        <Button type="submit">Add watch</Button>
      </form>
      <div className="divide-hairline border-hairline mt-6 divide-y border-y">
        {watches.length ? (
          watches.map((watch) => (
            <div
              key={watch.id}
              className="flex flex-wrap items-center gap-3 py-3"
            >
              <Input
                aria-label="Watch date"
                type="date"
                value={watch.watchedOn}
                onChange={(event) =>
                  setWatches((current) =>
                    current.map((item) =>
                      item.id === watch.id
                        ? { ...item, watchedOn: event.target.value }
                        : item,
                    ),
                  )
                }
                className="w-auto"
              />
              <label className="text-paper-300 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={watch.isRewatch}
                  onChange={(event) =>
                    setWatches((current) =>
                      current.map((item) =>
                        item.id === watch.id
                          ? { ...item, isRewatch: event.target.checked }
                          : item,
                      ),
                    )
                  }
                  className="accent-accent-400"
                />{" "}
                Rewatch
              </label>
              <QuietButton onClick={() => save(watch)}>Save</QuietButton>
              <button
                onClick={() => remove(watch.id)}
                className="text-paper-500 hover:text-paper-100 text-xs underline underline-offset-4"
              >
                Delete
              </button>
            </div>
          ))
        ) : (
          <p className="text-paper-500 py-6 text-sm">No watches logged yet.</p>
        )}
      </div>
      {message ? (
        <p className="text-paper-500 mt-4 text-sm" role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}
