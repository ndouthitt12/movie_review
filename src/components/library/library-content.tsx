import { connection } from "next/server";
import { AddFilmDialog } from "@/components/library/add-film-dialog";
import { LibraryView } from "@/components/library/library-view";
import { SectionHeader } from "@/components/section-header";
import { getCatalogOptions, getLibraryFilms } from "@/lib/catalog";
import { getRcaTagsWithUsage } from "@/lib/rca";

/** Shared body of the Library and Watchlist pages. */
export async function LibraryContent({
  mode,
}: {
  mode: "library" | "watchlist";
}) {
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
      <SectionHeader
        title={mode === "watchlist" ? "Watchlist" : "Library"}
        description={
          mode === "watchlist"
            ? "Films to watch, in your order, and films to watch again. Drag a film to change the order."
            : "Every film you have logged. Sort by any score, or filter by genre, franchise, year or why tag."
        }
        action={
          <AddFilmDialog
            genres={options.genres}
            franchiseNames={rootFranchises}
          />
        }
      />
      <LibraryView
        films={films}
        genres={options.genres}
        franchises={filterFranchises}
        rcaTags={rcaTags}
        mode={mode}
      />
    </>
  );
}
