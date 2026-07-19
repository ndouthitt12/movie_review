import { Suspense } from "react";
import { connection } from "next/server";
import { AddFilmDialog } from "@/components/library/add-film-dialog";
import { LibraryView } from "@/components/library/library-view";
import { PageShell } from "@/components/page-shell";
import { RouteContentLoading } from "@/components/route-content-loading";
import { getCatalogOptions, getLibraryFilms } from "@/lib/catalog";
import { getRcaTagsWithUsage } from "@/lib/rca";

export const unstable_instant = {
  prefetch: "runtime",
  samples: [
    {
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

export default function LibraryPage() {
  return (
    <PageShell>
      <Suspense fallback={<RouteContentLoading label="Loading library" />}>
        <LibraryContent />
      </Suspense>
    </PageShell>
  );
}

async function LibraryContent() {
  await connection();
  const [films, options, rcaTags] = await Promise.all([
    getLibraryFilms(),
    getCatalogOptions(),
    getRcaTagsWithUsage(),
  ]);
  const filterFranchises = [
    ...new Set(options.franchises.map(({ name }) => name)),
  ];
  const rootFranchises = options.franchises
    .filter(({ parentId }) => parentId === null)
    .map(({ name }) => name);
  return (
    <>
      <header className="mb-8 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Personal catalog</p>
          <h1 className="type-page-heading text-paper-100 mt-2 tracking-tight">
            Your films
          </h1>
          <p className="type-body text-paper-500 mt-3">
            Sort the scores, scan the posters, remember why.
          </p>
        </div>
        <AddFilmDialog
          genres={options.genres}
          franchiseNames={rootFranchises}
        />
      </header>
      <LibraryView
        films={films}
        genres={options.genres}
        franchises={filterFranchises}
        rcaTags={rcaTags}
      />
    </>
  );
}
