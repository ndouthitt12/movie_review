import type { ReactNode } from "react";
import { TabBar, type TabItem } from "@/components/ui/tab-bar";

export const discoverTabs: TabItem[] = [
  { label: "Trending", href: "/trending" },
  { label: "For you", href: "/recommendations" },
];

export const statsTabs: TabItem[] = [
  { label: "Overview", href: "/dashboard" },
  { label: "How I rate", href: "/rubric" },
  { label: "Why tags", href: "/tags" },
];

/** Page title, one line of description, and the sub-tabs for its group. */
export function SectionHeader({
  title,
  description,
  tabs,
  action,
}: {
  title: string;
  description?: ReactNode;
  tabs?: TabItem[];
  action?: ReactNode;
}) {
  return (
    <header className="mb-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="type-page-heading text-paper-100 tracking-[-0.02em]">
            {title}
          </h1>
          {description ? (
            <p className="text-paper-500 mt-2 max-w-2xl text-sm">
              {description}
            </p>
          ) : null}
        </div>
        {action}
      </div>
      {tabs ? <TabBar tabs={tabs} className="mt-5" /> : null}
    </header>
  );
}
