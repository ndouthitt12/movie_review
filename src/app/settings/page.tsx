import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { PageShell } from "@/components/page-shell";
import { SectionHeader } from "@/components/section-header";
import { ScoreScaleSetting } from "@/components/settings/score-scale-setting";
import { ChevronRightIcon } from "@/components/ui/icons";
import { getScoreScale } from "@/lib/score-scale";

// Only the display setting reads live data, inside its own Suspense boundary.
// The rest of the page is prerendered and needs no unstable_instant check.
export const metadata: Metadata = { title: "Settings" };

const sections = [
  {
    title: "Why tags",
    href: "/admin/rca",
    description:
      "Create, merge, recolor and reorder the reasons you attach to ratings.",
  },
  {
    title: "Rating form",
    href: "/admin/form",
    description:
      "Edit the questions on the rating form and publish a new version.",
  },
  {
    title: "Scoring",
    href: "/admin/scoring",
    description:
      "Set how much each question counts, and recompute saved scores.",
  },
  {
    title: "Rating scale",
    href: "/admin/scale",
    description: "Edit what each level means. The How I rate page shows this.",
  },
  {
    title: "Form versions and export",
    href: "/admin/versions",
    description: "See past versions of the rating form and export your data.",
  },
  {
    title: "Admin overview",
    href: "/admin",
    description: "Library counts, system status and quick actions.",
  },
];

const groupHeading =
  "text-paper-500 mb-3 text-[0.68rem] font-semibold tracking-[0.12em] uppercase";

export default function SettingsPage() {
  return (
    <PageShell>
      <SectionHeader
        title="Settings"
        description="Choose how scores show, and change how ratings work. Changes ask for your admin passcode."
      />
      <section aria-labelledby="display-heading" className="mb-8 max-w-3xl">
        <h2 id="display-heading" className={groupHeading}>
          Display
        </h2>
        <div className="border-hairline bg-ink-900 rounded-card border">
          <Suspense fallback={<ScoreScaleSetting initialScale={null} />}>
            <DisplaySettings />
          </Suspense>
        </div>
      </section>
      <section aria-labelledby="tools-heading" className="max-w-3xl">
        <h2 id="tools-heading" className={groupHeading}>
          Rating tools
        </h2>
        <ul className="border-hairline divide-hairline bg-ink-900 rounded-card divide-y border">
          {sections.map((section) => (
            <li key={section.href}>
              <Link
                href={section.href}
                className="group hover:bg-ink-850 flex items-center gap-4 px-5 py-4 transition-colors"
              >
                <span className="min-w-0 flex-1">
                  <span className="text-paper-100 group-hover:text-accent-300 block font-semibold">
                    {section.title}
                  </span>
                  <span className="text-paper-500 mt-0.5 block text-sm">
                    {section.description}
                  </span>
                </span>
                <ChevronRightIcon className="text-paper-500 h-4 w-4 shrink-0" />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </PageShell>
  );
}

async function DisplaySettings() {
  await connection();
  return <ScoreScaleSetting initialScale={await getScoreScale()} />;
}
