import Link from "next/link";
import type { ReactNode } from "react";

export function SectionCard({
  title,
  action,
  children,
  className = "",
}: {
  title: string;
  action?: { label?: string; href: string };
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel p-5 sm:p-6 ${className}`}>
      <header className="mb-5 flex items-center justify-between gap-4">
        <h2 className="eyebrow">{title}</h2>
        {action ? (
          <Link
            href={action.href}
            className="text-accent-400 hover:text-accent-300 text-sm transition-colors"
          >
            {action.label ?? "View all"} <span aria-hidden="true">›</span>
          </Link>
        ) : null}
      </header>
      {children}
    </section>
  );
}
