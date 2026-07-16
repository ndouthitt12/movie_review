import { asc } from "drizzle-orm";
import { Suspense } from "react";
import { ScaleEditor } from "@/components/admin/scale-editor";
import { RouteContentLoading } from "@/components/route-content-loading";
import { db } from "@/db";
import { scaleLevels } from "@/db/schema";

export default function AdminScalePage() {
  return (
    <Suspense fallback={<RouteContentLoading label="Loading rating scale" />}>
      <AdminScaleContent />
    </Suspense>
  );
}

async function AdminScaleContent() {
  const levels = await db
    .select()
    .from(scaleLevels)
    .orderBy(asc(scaleLevels.level));
  return (
    <div>
      <header className="page-heading">
        <p className="eyebrow">Public rating reference</p>
        <h1>Rating Scale</h1>
        <p>Edit the 11 levels shown on the public rubric page.</p>
      </header>
      <ScaleEditor initialLevels={levels} />
    </div>
  );
}
