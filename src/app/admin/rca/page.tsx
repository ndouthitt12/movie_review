import { Suspense } from "react";
import { RcaManager } from "@/components/rca/rca-manager";
import { RouteContentLoading } from "@/components/route-content-loading";
import { ensureDraftForm } from "@/lib/admin-form";
import { getRcaTagsWithUsage } from "@/lib/rca";

export default function AdminRcaPage() {
  return (
    <Suspense fallback={<RouteContentLoading label="Loading RCA tags" />}>
      <AdminRcaContent />
    </Suspense>
  );
}

async function AdminRcaContent() {
  const tags = await getRcaTagsWithUsage();
  const draft = await ensureDraftForm();
  const questionOptions = [
    ...draft.questions.map(({ key, label }) => ({ key, label })),
    { key: "overall", label: "Overall" },
  ];
  return (
    <div>
      <header className="page-heading">
        <p className="eyebrow">Rating vocabulary</p>
        <h1>RCA Tags</h1>
        <p>
          Bind each why-tag to an RCA-enabled draft question or to the overall
          score.
        </p>
      </header>
      <RcaManager initialTags={tags} questionOptions={questionOptions} />
    </div>
  );
}
