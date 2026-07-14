import { FormBuilder } from "@/components/admin/form-builder";
import { ensureDraftForm } from "@/lib/admin-form";

export const dynamic = "force-dynamic";

export default async function AdminFormPage() {
  return <FormBuilder initialForm={await ensureDraftForm()} />;
}
