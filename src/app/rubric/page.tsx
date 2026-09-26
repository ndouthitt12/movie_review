import type { Metadata } from "next";
import { Suspense } from "react";
import { PageShell } from "@/components/page-shell";
import { RouteContentLoading } from "@/components/route-content-loading";
import { SectionHeader, statsTabs } from "@/components/section-header";
import { Stars } from "@/components/ui/stars";
import { getRubric } from "@/lib/catalog";
import { formatScore } from "@/lib/score-format";
import { getScoreScale } from "@/lib/score-scale";

export const unstable_instant = { prefetch: "static" };
export const metadata: Metadata = { title: "How I rate" };

export default function RubricPage() {
  return (
    <PageShell>
      <SectionHeader
        title="Stats"
        description="What each level of your scale means, with example films."
        tabs={statsTabs}
      />
      <Suspense
        fallback={<RouteContentLoading label="Loading rating rubric" />}
      >
        <RubricContent />
      </Suspense>
    </PageShell>
  );
}

async function RubricContent() {
  const [rubric, scale] = await Promise.all([getRubric(), getScoreScale()]);
  return (
    <>
      <p className="text-paper-500 mb-4 text-sm">
        {scale === 5
          ? "Scores show out of 5. Each level is half a point."
          : "Scores show out of 10. Each level is one point."}
      </p>
      <ol className="border-hairline divide-hairline bg-ink-900 rounded-card divide-y border">
        {rubric.map((row) => (
          <li
            key={row.level}
            className="grid gap-x-6 gap-y-2 px-5 py-4 sm:grid-cols-[7rem_1fr] sm:items-start"
          >
            <div className="flex items-baseline gap-3 sm:block">
              <p className="text-accent-400 font-mono text-3xl font-semibold tabular-nums">
                {formatScore(row.level, scale)}
              </p>
              {/* Out of 10 the score already is the level. */}
              {scale === 5 ? (
                <p className="text-paper-500 text-xs sm:mt-1">
                  Level {row.level}
                </p>
              ) : null}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <p className="text-paper-100 text-base font-semibold">
                  {row.title || row.meaning}
                </p>
                <Stars value={row.level / 2} className="text-sm" />
              </div>
              {row.title && row.meaning ? (
                <p className="text-paper-300 mt-1 text-sm leading-6">
                  {row.meaning}
                </p>
              ) : null}
              <p className="text-paper-500 mt-2 text-sm">
                {row.exampleFilms
                  ? `Examples: ${row.exampleFilms}`
                  : "No example films yet"}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </>
  );
}
