import { ScoringAdmin } from "@/components/admin/scoring-admin";
import { ensureDraftForm } from "@/lib/admin-form";

export const dynamic = "force-dynamic";

export default async function AdminScoringPage() {
  return <ScoringAdmin initialForm={await ensureDraftForm()} />;
}
