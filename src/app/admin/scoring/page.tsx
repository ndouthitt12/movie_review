import { ScoringAdmin } from "@/components/admin/scoring-admin";
import { ensureDraftForm } from "@/lib/admin-form";

export const dynamic = "force-dynamic";

export default function AdminScoringPage() {
  return <ScoringAdmin initialForm={ensureDraftForm()} />;
}
