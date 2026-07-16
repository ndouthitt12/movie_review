import { Suspense } from "react";
import { FormBuilder } from "@/components/admin/form-builder";
import { RouteContentLoading } from "@/components/route-content-loading";
import { ensureDraftForm } from "@/lib/admin-form";

export default function AdminFormPage() {
  return (
    <Suspense fallback={<RouteContentLoading label="Loading form editor" />}>
      <AdminFormContent />
    </Suspense>
  );
}

async function AdminFormContent() {
  return <FormBuilder initialForm={await ensureDraftForm()} />;
}
