import type { Metadata } from "next";

// The title lives here because a metadata export on a page that uses
// runtime prefetching makes the production build hang (Next.js 16.2).
export const metadata: Metadata = { title: "Watchlist" };

export default function WatchlistLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
