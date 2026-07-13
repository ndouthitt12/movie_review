import { AddFilmDialog } from "@/components/library/add-film-dialog";
import { LibraryView } from "@/components/library/library-view";
import { PageShell } from "@/components/page-shell";
import { getCatalogOptions, getLibraryFilms } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  const [films, options] = await Promise.all([
    getLibraryFilms(),
    getCatalogOptions(),
  ]);
  const filterFranchises = [
    ...new Set(options.franchises.map(({ name }) => name)),
  ];
  const rootFranchises = options.franchises
    .filter(({ parentId }) => parentId === null)
    .map(({ name }) => name);
  return (
    <PageShell>
      <header className="mb-10 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-accent-300 text-xs tracking-[0.22em] uppercase">
            Personal catalog
          </p>
          <h1 className="text-paper-100 mt-3 font-serif text-5xl tracking-tight">
            The library
          </h1>
          <p className="text-paper-500 mt-3 text-sm">
            Dense when you need it. Cinematic when you don’t.
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
      />
    </PageShell>
  );
}
