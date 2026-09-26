import type { Metadata } from "next";

// The title lives here because a metadata export on a page that uses
// runtime prefetching makes the production build hang (Next.js 16.2).
export const metadata: Metadata = { title: "Library" };

export default function LibraryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
