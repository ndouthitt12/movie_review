import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { SectionHeader } from "@/components/section-header";
import { ChevronRightIcon } from "@/components/ui/icons";

// No live data here, so the whole page is prerendered and needs no
// unstable_instant check.
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

export default function SettingsPage() {
  return (
    <PageShell>
      <SectionHeader
        title="Settings"
        description="These tools change how ratings work. They ask for your admin passcode."
      />
      <ul className="border-hairline divide-hairline bg-ink-900 rounded-card max-w-3xl divide-y border">
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
    </PageShell>
  );
}
