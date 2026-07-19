import { desc } from "drizzle-orm";
import { Suspense } from "react";
import { RouteContentLoading } from "@/components/route-content-loading";
import { db } from "@/db";
import { formVersions } from "@/db/schema";

export default function AdminVersionsPage() {
  return (
    <Suspense fallback={<RouteContentLoading label="Loading form versions" />}>
      <AdminVersionsContent />
    </Suspense>
  );
}

async function AdminVersionsContent() {
  const versions = await db
    .select()
    .from(formVersions)
    .orderBy(desc(formVersions.id));
  return (
    <div>
      <header className="page-heading flex max-w-none flex-wrap items-end justify-between gap-5">
        <div>
          <p className="eyebrow">Form history</p>
          <h1>Versions</h1>
          <p>Published ratings retain the form version that produced them.</p>
        </div>
        <div className="flex gap-3">
          <a
            className="rounded-ui border-hairline text-paper-300 border px-4 py-2 text-sm"
            href="/api/admin/export?format=csv"
          >
            Export CSV
          </a>
          <a
            className="rounded-ui border-hairline text-paper-300 border px-4 py-2 text-sm"
            href="/api/admin/export?format=json"
          >
            Export JSON
          </a>
        </div>
      </header>
      <section className="panel divide-hairline divide-y overflow-hidden">
        {versions.map((version) => (
          <div
            key={version.id}
            className="grid gap-2 px-5 py-4 sm:grid-cols-[1fr_8rem_12rem]"
          >
            <span className="text-paper-100 font-medium">v{version.id}</span>
            <span className="text-paper-300 capitalize">{version.status}</span>
            <span className="text-paper-500 text-xs">
              {version.publishedAt ?? version.createdAt}
            </span>
          </div>
        ))}
      </section>
    </div>
  );
}
