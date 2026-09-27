"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { jumpPages } from "@/components/nav-items";
import { recordRoute, routeBefore } from "@/lib/route-history";

/** Records each route. PageShell renders one inside a Suspense boundary. */
export function RouteTracker() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  useEffect(() => {
    recordRoute(search ? `${pathname}?${search}` : pathname);
  }, [pathname, search]);
  return null;
}

/**
 * "← Library" by default. When the user came from another page in the app,
 * it names that page and goes back in history, which keeps its filters and
 * scroll position.
 */
export function BackLink({
  fallbackHref,
  fallbackLabel,
  className = "",
}: {
  fallbackHref: string;
  fallbackLabel: string;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  // The server has no history, so it renders the fallback.
  const previous = useSyncExternalStore(
    subscribe,
    () => routeBefore(`${pathname}${window.location.search}`),
    () => null,
  );

  const label = previous ? labelFor(previous) : fallbackLabel;
  return (
    <Link
      href={previous ?? fallbackHref}
      onClick={(event) => {
        if (!previous) return;
        event.preventDefault();
        router.back();
      }}
      className={className}
    >
      ← {label}
    </Link>
  );
}

function subscribe() {
  // The history only changes on navigation, which re-renders this link.
  return () => {};
}

function labelFor(route: string) {
  const exact = jumpPages.find(({ href }) => href === route);
  if (exact) return exact.label;
  const path = route.split("?")[0];
  const page = jumpPages.find(({ href }) => href === path);
  return page?.label ?? "Back";
}
