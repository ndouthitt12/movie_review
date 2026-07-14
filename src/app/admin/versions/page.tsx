import { desc } from "drizzle-orm";
import { db } from "@/db";
import { formVersions } from "@/db/schema";

export const dynamic = "force-dynamic";

export default async function AdminVersionsPage() {
  const versions = await db.select().from(formVersions).orderBy(desc(formVersions.id));
  return <div><header className="page-heading flex max-w-none flex-wrap items-end justify-between gap-5"><div><p className="eyebrow">Form history</p><h1>Versions</h1><p>Published ratings retain the form version that produced them.</p></div><div className="flex gap-3"><a className="rounded-ui border border-hairline px-4 py-2 text-sm text-paper-300" href="/api/admin/export?format=csv">Export CSV</a><a className="rounded-ui border border-hairline px-4 py-2 text-sm text-paper-300" href="/api/admin/export?format=json">Export JSON</a></div></header><section className="panel divide-y divide-hairline overflow-hidden">{versions.map((version) => <div key={version.id} className="grid gap-2 px-5 py-4 sm:grid-cols-[5rem_1fr_8rem_12rem]"><span className="text-paper-500">v{version.id}</span><span className="font-medium text-paper-100">{version.label}</span><span className="capitalize text-paper-300">{version.status}</span><span className="text-xs text-paper-500">{version.publishedAt ?? version.createdAt}</span></div>)}</section></div>;
}
