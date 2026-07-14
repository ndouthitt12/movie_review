"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type TabItem = { label: string; href: string; exact?: boolean };

export function TabBar({
  tabs,
  className = "",
}: {
  tabs: TabItem[];
  className?: string;
}) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Section navigation"
      className={`overflow-x-auto ${className}`}
    >
      <div className="border-hairline flex min-w-max gap-7 border-b">
        {tabs.map((tab) => {
          const active = tab.exact
            ? pathname === tab.href
            : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={`relative pb-3 text-sm transition-colors ${active ? "text-paper-100" : "text-paper-500 hover:text-paper-300"}`}
            >
              {tab.label}
              {active ? (
                <span className="bg-accent-400 absolute inset-x-0 bottom-[-1px] h-0.5" />
              ) : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
