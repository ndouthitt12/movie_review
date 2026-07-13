"use client";

import { useMemo, useState } from "react";
import { HeatmapCellGrid } from "@/components/charts/charts";
import { weeklyGoalPace } from "@/lib/streaks";
import type { DashboardWatch } from "@/lib/stats";

export function CalendarPanel({
  watches,
  today,
}: {
  watches: DashboardWatch[];
  today: string;
}) {
  const currentYear = Number(today.slice(0, 4));
  const years = useMemo(
    () =>
      [
        ...new Set([
          currentYear,
          ...watches.map(({ watchedOn }) => Number(watchedOn.slice(0, 4))),
        ]),
      ]
        .filter(Number.isInteger)
        .sort((left, right) => right - left),
    [currentYear, watches],
  );
  const [year, setYear] = useState(currentYear);
  const [goal, setGoal] = useState<number | null>(null);
  const days = useMemo(() => calendarDays(year, watches), [year, watches]);
  const pace = weeklyGoalPace(
    watches.map(({ watchedOn }) => watchedOn),
    goal,
    today,
  );
  return (
    <section className="panel overflow-hidden">
      <header className="border-hairline flex flex-col gap-4 border-b px-5 py-5 sm:flex-row sm:items-end sm:justify-between sm:px-7">
        <div>
          <p className="eyebrow">Watch calendar</p>
          <h2 className="text-paper-100 mt-1 text-2xl font-bold">
            Every film day
          </h2>
        </div>
        <label className="text-paper-500 flex items-center gap-2 text-xs">
          Year
          <select
            className="select-field w-28"
            value={year}
            onChange={(event) => setYear(Number(event.target.value))}
          >
            {years.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
      </header>
      <div className="overflow-x-auto px-5 py-6 sm:px-7">
        <div className="min-w-[660px]">
          <HeatmapCellGrid year={year} data={days} />
        </div>
        <p className="text-paper-500 mt-3 text-xs">
          Hover a cell to see the films watched that day.
        </p>
      </div>
      <div className="border-hairline bg-ink-850/50 grid gap-4 border-t px-5 py-5 sm:grid-cols-[1fr_auto] sm:items-center sm:px-7">
        <div>
          <p className="text-paper-100 text-sm font-semibold">
            Optional weekly goal
          </p>
          <p className="text-paper-500 mt-1 text-xs">
            {pace
              ? `${pace.watched} watched · ${pace.remaining} remaining · ${pace.status.replace("_", " ")}`
              : "Turn on a goal to see your pace for the current Monday–Sunday week."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            id="weekly-goal-enabled"
            type="checkbox"
            checked={goal !== null}
            onChange={(event) => setGoal(event.target.checked ? 3 : null)}
          />
          <label
            htmlFor="weekly-goal-enabled"
            className="text-paper-300 text-xs"
          >
            Goal
          </label>
          <input
            aria-label="Films per week"
            type="number"
            min={1}
            max={30}
            disabled={goal === null}
            value={goal ?? 3}
            onChange={(event) =>
              setGoal(Math.max(1, Number(event.target.value) || 1))
            }
            className="border-hairline bg-ink-900 text-paper-100 rounded-ui h-9 w-16 border px-2 text-sm tabular-nums"
          />
          <span className="text-paper-500 text-xs">films/week</span>
        </div>
      </div>
    </section>
  );
}

function calendarDays(year: number, watches: readonly DashboardWatch[]) {
  const byDate = new Map<string, string[]>();
  for (const watch of watches) {
    const list = byDate.get(watch.watchedOn) ?? [];
    list.push(watch.title ?? "Untitled film");
    byDate.set(watch.watchedOn, list);
  }
  const days = [];
  for (let day = 1; ; day += 1) {
    const date = new Date(Date.UTC(year, 0, day));
    if (date.getUTCFullYear() !== year) break;
    const key = date.toISOString().slice(0, 10);
    const titles = byDate.get(key) ?? [];
    days.push({
      date: key,
      count: titles.length,
      label: titles.length
        ? `${key}: ${titles.join(", ")}`
        : `${key}: no watches`,
    });
  }
  return days;
}
