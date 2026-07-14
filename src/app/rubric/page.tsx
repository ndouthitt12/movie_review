import type { Metadata } from "next";
import { PageShell } from "@/components/page-shell";
import { getRubric } from "@/lib/catalog";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Rating rubric" };

export default async function RubricPage() {
  const rubric = await getRubric();
  return (
    <PageShell>
      <header className="page-heading">
        <p className="eyebrow">Rating reference</p>
        <h1>The scale, in your words</h1>
        <p>
          Keep scores consistent over time by defining the meaning and
          touchstone films for every point.
        </p>
      </header>
      <section className="panel divide-y divide-hairline overflow-hidden">
        {rubric.map((row) => (
          <div key={row.level} className="grid gap-3 px-5 py-5 sm:grid-cols-[4rem_1fr] sm:px-7">
            <p className="text-accent-300 text-4xl font-bold tabular-nums">{row.level}</p>
            <div><p className="text-paper-100 text-lg font-semibold">{row.title || row.meaning}</p>{row.title && row.meaning ? <p className="text-paper-300 mt-1 text-sm">{row.meaning}</p> : null}<p className="text-paper-500 mt-2 text-sm italic">{row.exampleFilms || "No example films yet"}</p></div>
          </div>
        ))}
      </section>
    </PageShell>
  );
}
