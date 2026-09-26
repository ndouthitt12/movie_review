import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { PageShell } from "@/components/page-shell";
import { RcaChip } from "@/components/rca/rca-chip";
import { RouteContentLoading } from "@/components/route-content-loading";
import { SectionHeader, statsTabs } from "@/components/section-header";
import { getPublishedRuntimeForm } from "@/lib/form-config";
import { getRcaTagsWithUsage, type RcaTagWithUsage } from "@/lib/rca";

export const unstable_instant = { prefetch: "static" };
export const metadata: Metadata = { title: "Why tags" };

export default function TagsPage() {
  return (
    <PageShell>
      <SectionHeader
        title="Stats"
        description="The reasons you attach to ratings, grouped by the question they explain. Select a tag to see its films."
        tabs={statsTabs}
        action={
          <Link
            href="/admin/rca"
            className="border-hairline text-paper-300 hover:border-accent-400 hover:text-paper-100 rounded-ui border px-3 py-2 text-sm transition-colors"
          >
            Manage tags
          </Link>
        }
      />
      <Suspense fallback={<RouteContentLoading label="Loading why tags" />}>
        <TagsContent />
      </Suspense>
    </PageShell>
  );
}

async function TagsContent() {
  await connection();
  const [tags, form] = await Promise.all([
    getRcaTagsWithUsage(),
    getPublishedRuntimeForm(),
  ]);
  const labels = new Map(
    (form?.questions ?? []).map(({ key, label }) => [key, label] as const),
  );
  const groups = new Map<string, RcaTagWithUsage[]>();
  for (const tag of tags)
    groups.set(tag.questionKey, [...(groups.get(tag.questionKey) ?? []), tag]);
  const ordered = [...groups].sort(([left], [right]) =>
    left === "overall" ? -1 : right === "overall" ? 1 : 0,
  );

  if (!tags.length)
    return (
      <div className="border-hairline bg-ink-900 rounded-card border p-8">
        <p className="text-paper-300">
          No why tags yet. Add them while you rate a film, or create them under
          Manage tags.
        </p>
      </div>
    );

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {ordered.map(([questionKey, members]) => {
        const used = members.filter(({ usageCount }) => usageCount > 0).length;
        return (
          <section
            key={questionKey}
            className="border-hairline bg-ink-900 rounded-card border px-5 py-4"
          >
            <header className="mb-3 flex items-baseline justify-between gap-3">
              <h2 className="type-section-heading text-paper-100">
                {questionKey === "overall"
                  ? "Overall"
                  : (labels.get(questionKey) ?? readableKey(questionKey))}
              </h2>
              <p className="text-paper-500 font-mono text-xs tabular-nums">
                {used} of {members.length} in use
              </p>
            </header>
            <ul className="divide-hairline divide-y">
              {[...members]
                .sort(
                  (left, right) =>
                    right.usageCount - left.usageCount ||
                    left.label.localeCompare(right.label),
                )
                .map((tag) => (
                  <li key={tag.id}>
                    <Link
                      href={`/library?status=rated&rca=${tag.id}`}
                      className={`hover:bg-ink-850 -mx-2 flex items-center justify-between gap-3 rounded-md px-2 py-2 ${tag.usageCount ? "" : "opacity-55"}`}
                    >
                      <RcaChip tag={tag} />
                      <span className="text-paper-300 font-mono text-xs tabular-nums">
                        {tag.usageCount}{" "}
                        {tag.usageCount === 1 ? "film" : "films"}
                      </span>
                    </Link>
                  </li>
                ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

/** "genre_fit" → "Genre fit", for questions no longer on the published form. */
function readableKey(key: string) {
  const words = key.replaceAll("_", " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
