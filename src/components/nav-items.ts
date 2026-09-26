// One list drives the desktop tabs, the phone bar, and the Ctrl K page list,
// so every menu shows the same pages under the same names.

export type PrimaryNavItem = {
  label: string;
  href: string;
  /** Route prefixes that belong to this tab. "/" matches only the home page. */
  routes: string[];
};

export const primaryNav: PrimaryNavItem[] = [
  { label: "Rankings", href: "/", routes: ["/"] },
  { label: "Library", href: "/library", routes: ["/library", "/films"] },
  { label: "Watchlist", href: "/watchlist", routes: ["/watchlist"] },
  {
    label: "Discover",
    href: "/trending",
    routes: ["/trending", "/recommendations"],
  },
  {
    label: "Stats",
    href: "/dashboard",
    routes: ["/dashboard", "/rubric", "/tags"],
  },
];

export function isNavItemActive(item: PrimaryNavItem, pathname: string) {
  return item.routes.some((route) =>
    route === "/"
      ? pathname === "/"
      : pathname === route || pathname.startsWith(`${route}/`),
  );
}

/** Pages offered by the Ctrl K palette, with extra words it matches on. */
export const jumpPages = [
  { label: "Rankings", href: "/", keywords: "home ranked scores" },
  { label: "Library", href: "/library", keywords: "films watched" },
  {
    label: "Rated films",
    href: "/library?status=rated",
    keywords: "library scores",
  },
  { label: "Watchlist", href: "/watchlist", keywords: "to watch queue" },
  {
    label: "Rewatch queue",
    href: "/watchlist?status=to_rewatch",
    keywords: "watchlist again",
  },
  { label: "Trending", href: "/trending", keywords: "discover popular" },
  {
    label: "For you",
    href: "/recommendations",
    keywords: "discover recommended",
  },
  { label: "Stats", href: "/dashboard", keywords: "dashboard charts" },
  { label: "How I rate", href: "/rubric", keywords: "rubric scale stats" },
  { label: "Why tags", href: "/tags", keywords: "rca reasons stats" },
  { label: "Settings", href: "/settings", keywords: "admin form scoring" },
];
