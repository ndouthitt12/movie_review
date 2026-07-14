import type { Metadata } from "next";
import Image from "next/image";
import { ChartIcon, FilmIcon, StarIcon } from "@/components/ui/icons";
import { ListRow } from "@/components/ui/list-row";
import { SectionCard } from "@/components/ui/section-card";
import { Stars } from "@/components/ui/stars";
import { StatTile } from "@/components/ui/stat-tile";
import { getDashboardData, getLibraryFilms } from "@/lib/catalog";
import { dateInTimeZone } from "@/lib/dates";
import { tmdbImage } from "@/lib/tmdb";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin overview" };

export default async function AdminPage() {
  const [{ films, watches }, libraryFilms] = await Promise.all([
    getDashboardData(),
    getLibraryFilms(),
  ]);
  const filmById = new Map(libraryFilms.map((film) => [film.id, film]));
  const ratedFilms = films.filter((film) => film.rating !== null);
  const averageScore = average(ratedFilms.map((film) => film.rating!.overall));
  const watchedFilms = films.filter(
    (film) => film.status === "watched" || film.status === "to_rewatch",
  );
  const uniqueRcaTags = new Set(
    films.flatMap((film) => film.rcaTags.map((tag) => tag.id)),
  ).size;
  const recentWatches = [...watches]
    .sort((left, right) => right.watchedOn.localeCompare(left.watchedOn))
    .slice(0, 5);
  const activity = activityByDay(watches, dateInTimeZone());
  const previousTotal = activity.previous.reduce(
    (sum, value) => sum + value,
    0,
  );
  const activityDelta = compareActivity(activity.total, previousTotal);

  return (
    <div className="space-y-5 sm:space-y-6">
      <SectionCard title="Overview">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            icon={<FilmIcon />}
            value={films.length.toLocaleString()}
            label="Films"
          />
          <StatTile
            icon={<StarIcon />}
            value={ratedFilms.length.toLocaleString()}
            label="Ratings"
          />
          <StatTile
            icon={<WatchIcon />}
            value={watches.length.toLocaleString()}
            label="Watches"
          />
          <StatTile
            icon={<ChartIcon />}
            value={averageScore === null ? "—" : averageScore.toFixed(2)}
            label="Average score"
          />
        </div>
      </SectionCard>

      <SectionCard
        title="Recent activity"
        action={{ label: "View library", href: "/library" }}
      >
        {recentWatches.length ? (
          <div>
            {recentWatches.map((watch, index) => {
              const film = filmById.get(watch.filmId);
              const poster = film?.posterPath
                ? tmdbImage(film.posterPath, "w185")
                : null;
              return (
                <ListRow
                  key={`${watch.filmId}-${watch.watchedOn}-${index}`}
                  href={`/films/${watch.filmId}`}
                  leading={
                    poster ? (
                      <Image
                        src={poster!}
                        alt=""
                        width={44}
                        height={66}
                        className="bg-ink-800 h-14 w-10 rounded-md object-cover"
                      />
                    ) : (
                      <span className="bg-ink-850 flex h-14 w-10 items-center justify-center rounded-md">
                        <FilmIcon className="h-5 w-5" />
                      </span>
                    )
                  }
                  title={watch.title ?? film?.title ?? "Untitled film"}
                  subtitle={
                    film?.overall !== null && film?.overall !== undefined ? (
                      <span className="inline-flex items-center gap-2">
                        <Stars value={film.overall / 2} className="text-sm" />
                        <span className="text-paper-300 tabular-nums">
                          {film.overall.toFixed(2)}
                        </span>
                      </span>
                    ) : (
                      "Not rated"
                    )
                  }
                  trailing={
                    <span className="inline-flex items-center gap-3">
                      <time dateTime={watch.watchedOn}>
                        {formatShortDate(watch.watchedOn)}
                      </time>
                      <span
                        aria-hidden="true"
                        className="text-paper-500 text-lg leading-none"
                      >
                        ⋮
                      </span>
                    </span>
                  }
                />
              );
            })}
          </div>
        ) : (
          <EmptyState>No watch activity has been logged yet.</EmptyState>
        )}
      </SectionCard>

      <div className="grid gap-5 sm:gap-6 lg:grid-cols-[minmax(17rem,0.8fr)_minmax(0,1.2fr)]">
        <SectionCard title="Library counts">
          <ListRow
            href="/library?status=to_watch"
            leading={<BookmarkIcon className="h-5 w-5" />}
            title="To watch"
            trailing={films.filter((film) => film.status === "to_watch").length}
          />
          <ListRow
            href="/library?status=watched"
            leading={<StarIcon className="h-5 w-5" />}
            title="Watched without a rating"
            trailing={
              watchedFilms.filter((film) => film.rating === null).length
            }
          />
          <ListRow
            href="/library?status=to_rewatch"
            leading={<RewatchIcon className="h-5 w-5" />}
            title="To rewatch"
            trailing={
              films.filter((film) => film.status === "to_rewatch").length
            }
          />
          <ListRow
            href="/admin/rca"
            leading={<TagIcon className="h-5 w-5" />}
            title="RCA tags in use"
            trailing={uniqueRcaTags}
          />
        </SectionCard>

        <SectionCard title="Activity (last 7 days)">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-paper-100 text-4xl font-semibold tabular-nums">
                {activity.total.toLocaleString()}
              </p>
              <p className="text-paper-300 mt-1 text-sm">Watches logged</p>
              {activityDelta ? (
                <p
                  className={`mt-1.5 text-xs ${activityDelta.positive ? "text-positive" : "text-paper-500"}`}
                >
                  {activityDelta.label}
                </p>
              ) : null}
            </div>
          </div>
          <ActivityChart points={activity.current} labels={activity.labels} />
        </SectionCard>
      </div>

      <div className="grid gap-5 sm:gap-6 lg:grid-cols-2">
        <SectionCard title="System status">
          <StatusRow label="Database" status="Operational" />
          <StatusRow
            label="TMDB"
            status={process.env.TMDB_API_KEY ? "Configured" : "Not configured"}
            healthy={Boolean(process.env.TMDB_API_KEY)}
          />
        </SectionCard>

        <SectionCard title="Quick actions">
          <ListRow
            href="/library"
            leading={<FilmIcon className="h-5 w-5" />}
            title="Add film"
            subtitle="Open the library and search TMDB"
          />
          <ListRow
            href="/admin/form"
            leading={<FormIcon className="h-5 w-5" />}
            title="Edit form"
          />
          <ListRow
            href="/admin/scoring"
            leading={<ChartIcon className="h-5 w-5" />}
            title="Configure scoring"
          />
          <ListRow
            href="/admin/scale"
            leading={<StarIcon className="h-5 w-5" />}
            title="Edit rating scale"
          />
        </SectionCard>
      </div>
    </div>
  );
}

function ActivityChart({
  points,
  labels,
}: {
  points: number[];
  labels: string[];
}) {
  const width = 700;
  const height = 180;
  const chartTop = 16;
  const chartBottom = 138;
  const max = Math.max(1, ...points);
  const coordinates = points.map((value, index) => ({
    x: 14 + (index * (width - 28)) / Math.max(1, points.length - 1),
    y: chartBottom - (value / max) * (chartBottom - chartTop),
  }));
  const line = coordinates.map(({ x, y }) => `${x},${y}`).join(" ");
  const area = `M ${coordinates[0].x} ${chartBottom} L ${coordinates
    .map(({ x, y }) => `${x} ${y}`)
    .join(" L ")} L ${coordinates.at(-1)!.x} ${chartBottom} Z`;

  return (
    <div className="mt-5 overflow-hidden">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Daily watches for the last seven days: ${points.join(", ")}`}
      >
        <defs>
          <linearGradient id="admin-activity-fill" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0"
              stopColor="var(--color-accent-400)"
              stopOpacity="0.3"
            />
            <stop
              offset="1"
              stopColor="var(--color-accent-400)"
              stopOpacity="0"
            />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#admin-activity-fill)" />
        <polyline
          points={line}
          fill="none"
          stroke="var(--color-accent-400)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {coordinates.map(({ x, y }, index) => (
          <circle
            key={`${x}-${index}`}
            cx={x}
            cy={y}
            r="4.5"
            fill="var(--color-accent-400)"
            stroke="var(--color-ink-900)"
            strokeWidth="2"
          />
        ))}
        {labels.map((label, index) => (
          <text
            key={label}
            x={coordinates[index].x}
            y="169"
            textAnchor="middle"
            fill="var(--color-paper-500)"
            fontSize="11"
          >
            {label}
          </text>
        ))}
      </svg>
    </div>
  );
}

function StatusRow({
  label,
  status,
  healthy = true,
}: {
  label: string;
  status: string;
  healthy?: boolean;
}) {
  return (
    <div className="border-hairline flex min-h-12 items-center gap-3 border-b last:border-b-0">
      <span
        className={`h-2.5 w-2.5 rounded-full ${healthy ? "bg-positive" : "bg-accent-400"}`}
      />
      <span className="text-paper-100 flex-1 text-sm">{label}</span>
      <span
        className={
          healthy ? "text-positive text-xs" : "text-accent-400 text-xs"
        }
      >
        {status}
      </span>
    </div>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="text-paper-500 py-6 text-sm">{children}</p>;
}

function activityByDay(watches: Array<{ watchedOn: string }>, today: string) {
  const dates = Array.from({ length: 14 }, (_, index) =>
    shiftDate(today, index - 13),
  );
  const counts = new Map<string, number>();
  for (const watch of watches) {
    counts.set(watch.watchedOn, (counts.get(watch.watchedOn) ?? 0) + 1);
  }
  const values = dates.map((date) => counts.get(date) ?? 0);
  const current = values.slice(7);
  return {
    current,
    previous: values.slice(0, 7),
    total: current.reduce((sum, value) => sum + value, 0),
    labels: dates.slice(7).map(formatDayLabel),
  };
}

function compareActivity(current: number, previous: number) {
  if (current === previous) {
    return previous === 0
      ? null
      : { label: "No change from the previous 7 days", positive: false };
  }
  if (previous === 0) {
    return {
      label: `${current} more than the previous 7 days`,
      positive: current > 0,
    };
  }
  const change = Math.round(((current - previous) / previous) * 100);
  return {
    label: `${change > 0 ? "↑" : "↓"} ${Math.abs(change)}% vs previous 7 days`,
    positive: change > 0,
  };
}

function average(values: number[]) {
  return values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : null;
}

function shiftDate(date: string, days: number) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days))
    .toISOString()
    .slice(0, 10);
}

function formatDayLabel(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

function formatShortDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

function WatchIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function BookmarkIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={className}
      aria-hidden="true"
    >
      <path d="M6 4h12v17l-6-4-6 4V4Z" />
    </svg>
  );
}

function RewatchIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={className}
      aria-hidden="true"
    >
      <path d="M20 7v5h-5" />
      <path d="M18.2 16A8 8 0 1 1 19 8l1 4" />
    </svg>
  );
}

function TagIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={className}
      aria-hidden="true"
    >
      <path d="M3 12V5a2 2 0 0 1 2-2h7l9 9-9 9-9-9Z" />
      <circle cx="8" cy="8" r="1" />
    </svg>
  );
}

function FormIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={className}
      aria-hidden="true"
    >
      <path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5" />
    </svg>
  );
}
