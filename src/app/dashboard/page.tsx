import type { Metadata } from "next";
import { Suspense } from "react";
import {
  BarChart,
  HistogramChart,
  RadarChart,
  Sparkline,
  TrendChart,
} from "@/components/charts/charts";
import { CalendarPanel } from "@/components/dashboard/calendar-panel";
import { PageShell } from "@/components/page-shell";
import { RouteContentLoading } from "@/components/route-content-loading";
import { getDashboardData } from "@/lib/catalog";
import { dateInTimeZone } from "@/lib/dates";
import { computeStreaks } from "@/lib/streaks";
import {
  attributeAverages,
  attributeOverallCorrelations,
  decadeBreakdown,
  franchiseReportCards,
  genreBreakdown,
  headlineStats,
  overallHistogram,
  rcaTagFrequencies,
  watchesPerMonth,
  watchesPerYear,
} from "@/lib/stats";

export const unstable_instant = { prefetch: "static" };
export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <PageShell>
      <Suspense fallback={<RouteContentLoading label="Loading dashboard" />}>
        <DashboardContent />
      </Suspense>
    </PageShell>
  );
}

async function DashboardContent() {
  const {
    films,
    watches,
    attributes: dashboardAttributes,
  } = await getDashboardData();
  const today = dateInTimeZone();
  const headlines = headlineStats(films, watches, today);
  const streaks = computeStreaks(
    watches.map(({ watchedOn }) => watchedOn),
    today,
  );
  const histogram = overallHistogram(
    films.flatMap(({ rating }) => (rating ? [rating.overall] : [])),
  );
  const monthly = watchesPerMonth(watches, 3, today.slice(0, 7)).slice(-24);
  const yearly = watchesPerYear(watches);
  const attributes = attributeAverages(films, dashboardAttributes);
  const genres = genreBreakdown(films).sort(
    (left, right) =>
      right.count - left.count || left.label.localeCompare(right.label),
  );
  const decades = decadeBreakdown(films);
  const franchises = franchiseReportCards(films);
  const correlations = attributeOverallCorrelations(films, dashboardAttributes);
  const tags = rcaTagFrequencies(films);
  const strongest = correlations.find(
    ({ correlation }) => correlation !== null,
  );

  return (
    <>
      <header className="page-heading">
        <p className="eyebrow">Dashboard / trends</p>
        <h1>Your viewing, in focus</h1>
        <p>
          Distribution, habits, taste, and the reasons behind your ratings—all
          computed from the same film and watch records as the library.
        </p>
      </header>

      <section
        aria-label="Headline statistics"
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7"
      >
        <Headline label="Watched" value={headlines.totalWatched} />
        <Headline label="This month" value={headlines.thisMonth} />
        <Headline label="This year" value={headlines.thisYear} />
        <Headline
          label="Mean overall"
          value={headlines.meanOverall?.toFixed(2) ?? "—"}
        />
        <Headline
          label="Current day streak"
          value={streaks.day.current}
          detail={`Longest ${streaks.day.longest}`}
        />
        <Headline
          label="Current week streak"
          value={streaks.week.current}
          detail={`Longest ${streaks.week.longest}`}
        />
        <Headline
          label="Current month streak"
          value={streaks.month.current}
          detail={`Longest ${streaks.month.longest}`}
        />
      </section>

      <div className="mt-10 grid gap-6 xl:grid-cols-2">
        <ChartPanel
          eyebrow="Ratings"
          title="Overall distribution"
          caption="Actual ratings in 0.5-point buckets against a normalized expected bell curve centered at 6.5."
        >
          <HistogramChart
            data={histogram.map((bin, index) => ({
              ...bin,
              href: libraryHref({
                minScore: bin.start,
                maxScore: bin.end,
                ...(index < histogram.length - 1
                  ? { maxScoreExclusive: 1 }
                  : {}),
              }),
            }))}
          />
        </ChartPanel>
        <ChartPanel
          eyebrow="Watch history"
          title="Monthly rhythm"
          caption="The latest 24 months, including empty months, with a trailing three-month average."
        >
          <TrendChart data={monthly} />
        </ChartPanel>
      </div>

      <section className="panel mt-6 grid gap-6 p-5 sm:p-7 lg:grid-cols-[1fr_2fr] lg:items-center">
        <div>
          <p className="eyebrow">Long view</p>
          <h2 className="type-section-heading text-paper-100 mt-1">
            Watches by year
          </h2>
          <p className="text-paper-500 mt-3 text-sm leading-6">
            A compact view of how your yearly pace has changed.
          </p>
          <Sparkline
            values={yearly.map(({ count }) => count)}
            label="Yearly watch-count sparkline"
          />
        </div>
        <BarChart
          data={yearly.map(({ period, count }) => ({
            label: period,
            value: count,
          }))}
          height={210}
        />
      </section>

      <div className="mt-6">
        <CalendarPanel watches={watches} today={today} />
      </div>

      <div className="mt-10 grid gap-6 xl:grid-cols-2">
        <ChartPanel
          eyebrow="Rating profile"
          title="Attribute averages"
          caption="The shape of the scores you actually give, independent of formula weights."
        >
          <RadarChart
            data={attributes.map(({ label, average }) => ({
              label,
              value: average ?? 0,
            }))}
          />
        </ChartPanel>
        <section className="panel overflow-hidden">
          <header className="border-hairline border-b p-5 sm:p-7">
            <p className="eyebrow">Correlation</p>
            <h2 className="type-section-heading text-paper-100 mt-1">
              What moves Overall
            </h2>
            <p className="text-paper-500 mt-2 text-sm">
              {strongest?.correlation !== null && strongest
                ? `${strongest.label} has the strongest relationship with Overall (${formatCorrelation(strongest.correlation!)}).`
                : "Rate at least two films with varying scores to calculate correlations."}
            </p>
          </header>
          <div className="divide-hairline divide-y">
            {correlations.map((row) => (
              <div
                key={row.attribute}
                className="flex items-center justify-between px-5 py-3 sm:px-7"
              >
                <span className="text-paper-300 text-sm">{row.label}</span>
                <span className="text-accent-400 font-bold tabular-nums">
                  {row.correlation === null
                    ? "—"
                    : formatCorrelation(row.correlation)}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <ChartPanel
          eyebrow="Genres"
          title="Where you spend your time"
          caption="Counts include both primary and secondary genres. Select a bar to open that library slice."
        >
          <BarChart
            data={genres.slice(0, 12).map((row) => ({
              label: row.label,
              value: row.count,
              detail: `${row.count} films · ${row.average?.toFixed(2) ?? "—"} average`,
              href: libraryHref({ genre: row.label }),
            }))}
          />
        </ChartPanel>
        <ChartPanel
          eyebrow="Release eras"
          title="Decade breakdown"
          caption="Every rated film grouped by release decade. Select a bar to inspect it."
        >
          <BarChart
            data={decades.map((row) => {
              const start = Number(row.label.slice(0, 4));
              return {
                label: row.label,
                value: row.count,
                detail: `${row.count} films · ${row.average?.toFixed(2) ?? "—"} average`,
                href: libraryHref({ minYear: start, maxYear: start + 9 }),
              };
            })}
          />
        </ChartPanel>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <section className="panel overflow-hidden">
          <header className="border-hairline border-b p-5 sm:p-7">
            <p className="eyebrow">Franchises</p>
            <h2 className="type-section-heading text-paper-100 mt-1">
              Report cards
            </h2>
          </header>
          <RankedRows
            empty="No rated franchises yet."
            rows={franchises.slice(0, 12).map((row) => ({
              label: row.label,
              value: row.average?.toFixed(2) ?? "—",
              detail: `${row.count} film${row.count === 1 ? "" : "s"}`,
              href: libraryHref({ franchise: row.label }),
            }))}
          />
        </section>
        <section className="panel overflow-hidden">
          <header className="border-hairline border-b p-5 sm:p-7">
            <p className="eyebrow">RCA analytics</p>
            <h2 className="type-section-heading text-paper-100 mt-1">
              Your most common why tags
            </h2>
          </header>
          <RankedRows
            empty="Tag rated films to reveal recurring reasons."
            rows={tags.slice(0, 12).map((tag) => ({
              label: tag.label,
              value: String(tag.count),
              detail: `${attributeName(tag.questionKey, dashboardAttributes)} avg ${tag.averageScore === null ? "—" : tag.questionKey === "overall" ? tag.averageScore.toFixed(2) : tag.averageScore.toFixed(0)}`,
              href: libraryHref({ rca: tag.id }),
            }))}
          />
        </section>
      </div>
    </>
  );
}

function Headline({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail?: string;
}) {
  return (
    <div className="border-hairline bg-ink-850 rounded-ui border p-4">
      <p className="text-accent-400 text-2xl font-semibold tabular-nums">
        {value}
      </p>
      <p className="text-paper-500 mt-1 text-[10px] font-semibold tracking-wider uppercase">
        {label}
      </p>
      {detail ? (
        <p className="text-paper-500 mt-1 text-[10px]">{detail}</p>
      ) : null}
    </div>
  );
}

function ChartPanel({
  eyebrow,
  title,
  caption,
  children,
}: {
  eyebrow: string;
  title: string;
  caption: string;
  children: React.ReactNode;
}) {
  return (
    <section className="panel overflow-hidden">
      <header className="border-hairline border-b p-5 sm:p-7">
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="type-section-heading text-paper-100 mt-1">{title}</h2>
        <p className="text-paper-500 mt-2 text-sm leading-6">{caption}</p>
      </header>
      <div className="p-4 sm:p-6">{children}</div>
    </section>
  );
}

function RankedRows({
  rows,
  empty,
}: {
  rows: Array<{ label: string; value: string; detail: string; href: string }>;
  empty: string;
}) {
  if (!rows.length)
    return <p className="text-paper-500 p-7 text-sm">{empty}</p>;
  return (
    <ol className="divide-hairline divide-y">
      {rows.map((row, index) => (
        <li key={row.label}>
          <a
            href={row.href}
            className="hover:bg-ink-850 flex items-center gap-4 px-5 py-3 sm:px-7"
          >
            <span className="text-paper-500 w-5 text-xs tabular-nums">
              {index + 1}
            </span>
            <span className="text-paper-100 min-w-0 flex-1 truncate text-sm font-semibold">
              {row.label}
            </span>
            <span className="text-paper-500 text-xs">{row.detail}</span>
            <span className="text-accent-400 w-12 text-right font-bold tabular-nums">
              {row.value}
            </span>
          </a>
        </li>
      ))}
    </ol>
  );
}

function libraryHref(filters: Record<string, string | number>) {
  const params = new URLSearchParams({ status: "rated" });
  for (const [key, value] of Object.entries(filters))
    params.set(key, String(value));
  return `/library?${params}`;
}

function formatCorrelation(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}`;
}

function attributeName(
  questionKey: string,
  attributes: Array<{ key: string; label: string }>,
) {
  if (questionKey === "overall") return "Overall";
  return (
    attributes.find(({ key }) => key === questionKey)?.label ?? questionKey
  );
}
