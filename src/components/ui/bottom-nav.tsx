"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import { useCommandPalette } from "@/components/command-palette";
import { isNavItemActive, primaryNav } from "@/components/nav-items";
import {
  ChartIcon,
  FilmIcon,
  PlusIcon,
  RankingsIcon,
  TrendIcon,
  type IconProps,
} from "@/components/ui/icons";

// The phone bar has room for four pages plus the Rate button. Watchlist is
// reached from the Library tabs.
const icons: Record<string, ComponentType<IconProps>> = {
  Rankings: RankingsIcon,
  Library: FilmIcon,
  Discover: TrendIcon,
  Stats: ChartIcon,
};

export function BottomNav() {
  const pathname = usePathname();
  const { openPalette } = useCommandPalette();
  const items = primaryNav.filter(({ label }) => label in icons);
  const watchlistItem = primaryNav.find(({ label }) => label === "Watchlist")!;

  const links = items.map((item) => {
    const active =
      isNavItemActive(item, pathname) ||
      (item.label === "Library" && isNavItemActive(watchlistItem, pathname));
    const Icon = icons[item.label];
    return (
      <Link
        key={item.label}
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={`flex min-h-16 flex-col items-center justify-center gap-1 px-1 text-[0.68rem] font-medium transition-colors ${
          active ? "text-paper-100" : "text-paper-500 hover:text-paper-300"
        }`}
      >
        <Icon className="h-5 w-5" />
        <span>{item.label}</span>
      </Link>
    );
  });

  return (
    <nav
      aria-label="Mobile navigation"
      className="border-hairline bg-ink-900 fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 border-t pb-[env(safe-area-inset-bottom,0px)] min-[901px]:hidden"
    >
      {links.slice(0, 2)}
      <div className="flex items-center justify-center">
        <button
          type="button"
          onClick={() => openPalette("rate")}
          aria-label="Rate a film"
          className="bg-accent-400 -mt-5 grid h-12 w-12 place-items-center rounded-full text-[#1a0e08] shadow-[0_0_0_5px_var(--color-ink-900)]"
        >
          <PlusIcon className="h-6 w-6" />
        </button>
      </div>
      {links.slice(2)}
    </nav>
  );
}
