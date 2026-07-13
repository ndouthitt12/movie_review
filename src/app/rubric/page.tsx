import type { Metadata } from "next";
import { PageShell } from "@/components/page-shell";
import { RubricEditor } from "@/components/rubric-editor";
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
      <RubricEditor initial={rubric} />
    </PageShell>
  );
}
