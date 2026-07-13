import { MultiselectDemo } from "@/components/rca/multiselect-demo";
import { PageShell } from "@/components/page-shell";

export default function ComponentsPage() {
  return (
    <PageShell>
      <header className="page-heading">
        <p className="eyebrow">Development / components</p>
        <h1>RCA multiselect</h1>
        <p>
          Type to filter, use arrow keys and Enter, remove chips, or create a
          new neutral tag inline.
        </p>
      </header>
      <section className="panel max-w-2xl p-7">
        <label className="text-paper-100 mb-3 block text-sm font-semibold">
          Story
        </label>
        <MultiselectDemo />
      </section>
    </PageShell>
  );
}
