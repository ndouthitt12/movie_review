import type { Metadata } from "next";
import { Suspense } from "react";
import { PageShell } from "@/components/page-shell";
import { RouteContentLoading } from "@/components/route-content-loading";
import { SectionCard } from "@/components/ui/section-card";
import { Stars } from "@/components/ui/stars";
import { getRubric } from "@/lib/catalog";

export const unstable_instant = { prefetch: "static" };
export const metadata: Metadata = { title: "Rating rubric" };

export default function RubricPage() {
  return (
    <PageShell>
      <Suspense
        fallback={<RouteContentLoading label="Loading rating rubric" />}
      >
        <RubricContent />
      </Suspense>
    </PageShell>
  );
}

async function RubricContent() {
  const rubric = await getRubric();
  return (
    <>
      <header className="page-heading">
        <p className="eyebrow">Rating reference</p>
        <h1>The scale, in your words</h1>
        <p>
          Keep scores consistent over time by defining the meaning and
          touchstone films for every point.
        </p>
      </header>
      <div className="grid gap-3 md:grid-cols-2">
        {rubric.map((row) => (
          <SectionCard key={row.level} title={`Level ${row.level}`}>
            <div className="grid grid-cols-[4rem_1fr] gap-4">
              <p className="type-score text-accent-400">{row.level}</p>
              <div>
                <Stars value={row.level / 2} className="text-sm" />
                <p className="text-paper-100 mt-2 text-lg font-semibold">
                  {row.title || row.meaning}
                </p>
                {row.title && row.meaning ? (
                  <p className="text-paper-300 mt-1 text-sm leading-6">
                    {row.meaning}
                  </p>
                ) : null}
                <p className="text-paper-500 mt-3 text-sm italic">
                  {row.exampleFilms || "No example films yet"}
                </p>
              </div>
            </div>
          </SectionCard>
        ))}
      </div>
    </>
  );
}
