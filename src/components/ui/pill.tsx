import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

const pillClass = (active: boolean, className: string) =>
  `inline-flex min-h-9 items-center justify-center rounded-full border px-4 text-sm font-medium transition-colors ${
    active
      ? "border-accent-400 text-accent-400 bg-transparent"
      : "border-ink-800 bg-ink-850 text-paper-300 hover:border-paper-500 hover:text-paper-100"
  } ${className}`;

export function Pill({
  active = false,
  href,
  children,
  className = "",
  ...buttonProps
}: {
  active?: boolean;
  href?: string;
  children: ReactNode;
  className?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return href ? (
    <Link
      href={href}
      className={pillClass(active, className)}
      aria-current={active ? "page" : undefined}
    >
      {children}
    </Link>
  ) : (
    <button
      type="button"
      className={pillClass(active, className)}
      {...buttonProps}
    >
      {children}
    </button>
  );
}
