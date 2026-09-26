import { Suspense } from "react";
import { ScoringAdmin } from "@/components/admin/scoring-admin";
import { RouteContentLoading } from "@/components/route-content-loading";
import { ensureDraftForm } from "@/lib/admin-form";
import { getCatalogOptions } from "@/lib/catalog";

export default function AdminScoringPage() {
  return (
    <Suspense fallback={<RouteContentLoading label="Loading scoring editor" />}>
      <AdminScoringContent />
    </Suspense>
  );
}

async function AdminScoringContent() {
  const [form, options] = await Promise.all([
    ensureDraftForm(),
    getCatalogOptions(),
  ]);
  return <ScoringAdmin initialForm={form} genres={options.genres} />;
}
