import { RcaManager } from "@/components/rca/rca-manager";
import { ensureDraftForm } from "@/lib/admin-form";
import { getRcaTagsWithUsage } from "@/lib/rca";

export const dynamic = "force-dynamic";

export default async function AdminRcaPage() {
  const tags = await getRcaTagsWithUsage();
  const draft = ensureDraftForm();
  const questionOptions = [
    ...draft.questions.map(({ key, label }) => ({ key, label })),
    { key: "overall", label: "Overall" },
  ];
  return <div><header className="page-heading"><p className="eyebrow">Rating vocabulary</p><h1>RCA Tags</h1><p>Bind each why-tag to an RCA-enabled draft question or to the overall score.</p></header><RcaManager initialTags={tags} questionOptions={questionOptions} /></div>;
}
