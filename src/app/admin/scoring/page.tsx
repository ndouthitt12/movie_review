import { Suspense } from "react";
import { ScoringAdmin } from "@/components/admin/scoring-admin";
import { RouteContentLoading } from "@/components/route-content-loading";
import { ensureDraftForm } from "@/lib/admin-form";

export default function AdminScoringPage() {
  return (
    <Suspense fallback={<RouteContentLoading label="Loading scoring editor" />}>
      <AdminScoringContent />
    </Suspense>
  );
}

async function AdminScoringContent() {
  return <ScoringAdmin initialForm={await ensureDraftForm()} />;
}
