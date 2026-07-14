import { FormBuilder } from "@/components/admin/form-builder";
import { ensureDraftForm } from "@/lib/admin-form";

export const dynamic = "force-dynamic";

export default function AdminFormPage() {
  return <FormBuilder initialForm={ensureDraftForm()} />;
}
