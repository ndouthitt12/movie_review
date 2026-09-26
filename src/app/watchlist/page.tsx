import { Suspense } from "react";
import { LibraryContent } from "@/components/library/library-content";
import { PageShell } from "@/components/page-shell";
import { RouteContentLoading } from "@/components/route-content-loading";

export const unstable_instant = {
  prefetch: "runtime",
  samples: [
    {
      // The shared library view reads every filter, even the hidden ones.
      searchParams: {
        status: null,
        view: null,
        sort: null,
        dir: null,
        rca: null,
        q: null,
        genre: null,
        franchise: null,
        minYear: null,
        maxYear: null,
        minScore: null,
        maxScore: null,
        maxScoreExclusive: null,
        rcaMode: null,
      },
    },
  ],
};

export default function WatchlistPage() {
  return (
    <PageShell>
      <Suspense fallback={<RouteContentLoading label="Loading watchlist" />}>
        <LibraryContent mode="watchlist" />
      </Suspense>
    </PageShell>
  );
}
