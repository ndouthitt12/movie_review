import { Suspense } from "react";
import { LibraryContent } from "@/components/library/library-content";
import { PageShell } from "@/components/page-shell";
import { RouteContentLoading } from "@/components/route-content-loading";

// No unstable_instant here. Its runtime prefetch check made `next build`
// hang on this page (Next.js 16.2.10), so production deploys failed.

export default function WatchlistPage() {
  return (
    <PageShell>
      <Suspense fallback={<RouteContentLoading label="Loading watchlist" />}>
        <LibraryContent mode="watchlist" />
      </Suspense>
    </PageShell>
  );
}
