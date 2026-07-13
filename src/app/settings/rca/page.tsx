import { PageShell } from "@/components/page-shell";
import { RcaManager } from "@/components/rca/rca-manager";
import { getRcaTagsWithUsage } from "@/lib/rca";

export const dynamic = "force-dynamic";

export default async function RcaSettingsPage() {
  const tags = await getRcaTagsWithUsage();
  return (
    <PageShell>
      <header className="page-heading">
        <p className="eyebrow">Settings / RCA vocabulary</p>
        <h1>Why tags</h1>
        <p>
          Shape the vocabulary behind your ratings. Usage counts update as films
          are tagged.
        </p>
      </header>
      <RcaManager initialTags={tags} />
    </PageShell>
  );
}
