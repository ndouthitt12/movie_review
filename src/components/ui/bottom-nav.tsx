"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookmarkIcon,
  ChartIcon,
  CompassIcon,
  HomeIcon,
  StarIcon,
} from "@/components/ui/icons";

const items = [
  { label: "Home", href: "/", icon: HomeIcon, exact: true },
  { label: "Library", href: "/library", icon: CompassIcon },
  { label: "Rubric", href: "/rubric", icon: StarIcon },
  { label: "Watchlist", href: "/library?status=to_watch", icon: BookmarkIcon },
  { label: "Stats", href: "/dashboard", icon: ChartIcon },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Mobile navigation"
      className="border-hairline bg-ink-900 fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 border-t md:hidden"
    >
      {items.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname.startsWith(item.href.split("?")[0]);
        const Icon = item.icon;
        return (
          <Link
            key={item.label}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-16 flex-col items-center justify-center gap-1 px-1 text-[0.65rem] font-medium transition-colors ${
              active ? "text-accent-400" : "text-paper-500 hover:text-paper-100"
            }`}
          >
            <Icon className="h-5 w-5" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
