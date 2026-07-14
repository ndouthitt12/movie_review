import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRightIcon } from "@/components/ui/icons";

export function ListRow({
  href,
  leading,
  title,
  subtitle,
  trailing,
  className = "",
}: {
  href?: string;
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  className?: string;
}) {
  const content = (
    <>
      {leading ? (
        <span className="text-accent-400 shrink-0">{leading}</span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="text-paper-100 block truncate text-sm">{title}</span>
        {subtitle ? (
          <span className="text-paper-500 mt-1 block text-xs">{subtitle}</span>
        ) : null}
      </span>
      {trailing ? (
        <span className="text-paper-300 shrink-0 text-sm tabular-nums">
          {trailing}
        </span>
      ) : null}
      {href ? (
        <ChevronRightIcon className="text-paper-500 h-4 w-4 shrink-0" />
      ) : null}
    </>
  );
  const classes = `border-hairline flex min-h-14 items-center gap-3 border-b py-3 last:border-b-0 ${className}`;
  return href ? (
    <Link
      href={href}
      className={`${classes} hover:text-accent-400 transition-colors`}
    >
      {content}
    </Link>
  ) : (
    <div className={classes}>{content}</div>
  );
}
