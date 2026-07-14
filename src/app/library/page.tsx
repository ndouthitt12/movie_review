import { AddFilmDialog } from "@/components/library/add-film-dialog";
import { LibraryView } from "@/components/library/library-view";
import { PageShell } from "@/components/page-shell";
import { getCatalogOptions, getLibraryFilms } from "@/lib/catalog";
import { getRcaTagsWithUsage } from "@/lib/rca";

export const dynamic = "force-dynamic";

export default async function LibraryPage() {
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
    <PageShell>
      <header className="mb-8 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Personal catalog</p>
          <h1 className="text-paper-100 mt-2 font-serif text-4xl font-semibold tracking-tight sm:text-5xl">
            Your films
          </h1>
          <p className="text-paper-500 mt-3 text-sm">
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
    </PageShell>
  );
}
