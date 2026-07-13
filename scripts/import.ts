import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { createDb } from "../src/db";
import { defaultWeights } from "../src/db/seed-data";
import {
  films,
  franchises,
  ratings,
  settings,
  watchLog,
} from "../src/db/schema";
import {
  computeOverall,
  computeSecondary,
  type RatingWeights,
} from "../src/lib/scoring";
import {
  parseWorkbook,
  verifyImport,
  type ImportedFilm,
} from "../src/lib/importer";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const workbookArg = args.find((arg) => !arg.startsWith("--"));

if (!workbookArg) {
  console.error(
    "Usage: npm run import -- [--dry-run] path/to/movie-watchlist.xlsx",
  );
  process.exit(1);
}

const workbookPath = path.resolve(workbookArg);
if (!fs.existsSync(workbookPath)) {
  console.error(`Workbook not found: ${workbookPath}`);
  process.exit(1);
}

await main();

async function main() {
  const parsed = await parseWorkbook(workbookPath);
  let weights = defaultWeights;
  const connection = dryRun ? null : createDb();

  try {
    if (connection) {
      const setting = connection.db
        .select()
        .from(settings)
        .where(eq(settings.id, 1))
        .get();
      if (!setting)
        throw new Error(
          "Settings row is missing. Run npm run db:seed before importing.",
        );
      if (!isRatingWeights(setting.weights))
        throw new Error("Stored rating weights are invalid.");
      weights = setting.weights;
    }

    const verification = verifyImport(parsed.films, weights);
    const franchiseTree = new Map<string, Set<string>>();
    for (const film of parsed.films) {
      if (!film.upperFranchise) continue;
      const children =
        franchiseTree.get(film.upperFranchise) ?? new Set<string>();
      if (film.lowerFranchise) children.add(film.lowerFranchise);
      franchiseTree.set(film.upperFranchise, children);
    }

    console.log(
      `${dryRun ? "DRY RUN" : "IMPORT"}: ${parsed.films.length} films to create`,
    );
    console.log(
      `Statuses: watched=${verification.counts.watched}, to_watch=${verification.counts.to_watch}, to_rewatch=${verification.counts.to_rewatch}`,
    );
    console.log(
      `Weights: ${dryRun ? "canonical spreadsheet defaults" : "active database settings"}`,
    );
    console.log("Franchise tree:");
    for (const [parent, children] of franchiseTree) {
      console.log(`  + ${parent}`);
      for (const child of children) console.log(`    - ${child}`);
    }

    for (const error of parsed.errors)
      console.error(`! Row ${error.rowNumber}: ${error.message}`);
    for (const failure of verification.failures) console.error(`! ${failure}`);
    if (parsed.errors.length || verification.failures.length) {
      throw new Error(
        `Import aborted with ${parsed.errors.length + verification.failures.length} verification error(s).`,
      );
    }

    const expected = { watched: 365, to_watch: 355, to_rewatch: 63 };
    const countFailures = Object.entries(expected).filter(
      ([status, count]) =>
        verification.counts[status as keyof typeof expected] !== count,
    );
    if (countFailures.length) {
      for (const [status, count] of countFailures)
        console.error(
          `! ${status}: found ${verification.counts[status as keyof typeof expected]}, expected ${count}`,
        );
      throw new Error(
        "Import aborted because source-of-truth status counts do not match.",
      );
    }

    if (dryRun) {
      console.log("Verification passed. No database changes were made.");
      return;
    }

    const { db } = connection!;
    const existing = db.select({ id: films.id }).from(films).limit(1).all();
    if (existing.length)
      throw new Error(
        "Import requires an empty films table to prevent duplicates.",
      );

    const importedCount = db.transaction((tx) => {
      const franchiseIds = new Map<string, number>();
      const createFranchise = (name: string, parentId: number | null) => {
        const key = `${parentId ?? "root"}:${name.toLowerCase()}`;
        const cached = franchiseIds.get(key);
        if (cached) return cached;
        const row = tx
          .insert(franchises)
          .values({ name, parentId })
          .returning({ id: franchises.id })
          .get();
        franchiseIds.set(key, row.id);
        return row.id;
      };

      for (const film of parsed.films)
        insertFilm(tx, film, weights, createFranchise);

      const filmCount = tx.select({ id: films.id }).from(films).all().length;
      const ratingCount = tx
        .select({ id: ratings.id })
        .from(ratings)
        .all().length;
      const watchCount = tx
        .select({ id: watchLog.id })
        .from(watchLog)
        .all().length;
      const expectedRatings = parsed.films.filter(
        (film) => film.scores !== null,
      ).length;
      const expectedWatches = parsed.films.filter(
        (film) => film.lastWatchDate !== null,
      ).length;
      if (
        filmCount !== parsed.films.length ||
        ratingCount !== expectedRatings ||
        watchCount !== expectedWatches
      )
        throw new Error(
          "Persisted film/rating/watch counts failed verification; transaction rolled back.",
        );
      return filmCount;
    });

    console.log(
      `Import committed. ${importedCount} films written; all verification checks passed.`,
    );
  } finally {
    connection?.sqlite.close();
  }
}

function isRatingWeights(
  value: Record<string, number>,
): value is RatingWeights {
  const keys: Array<keyof RatingWeights> = [
    "story",
    "direction",
    "writing",
    "acting",
    "music",
    "impact",
    "rewatchability",
    "rewatchabilityOffset",
    "genreFit",
    "divisor",
  ];
  return keys.every((key) => Number.isFinite(value[key])) && value.divisor > 0;
}

type AppDb = ReturnType<typeof createDb>["db"];
type Transaction = Parameters<Parameters<AppDb["transaction"]>[0]>[0];

function insertFilm(
  tx: Transaction,
  film: ImportedFilm,
  weights: RatingWeights,
  createFranchise: (name: string, parentId: number | null) => number,
) {
  const franchiseId = film.upperFranchise
    ? createFranchise(film.upperFranchise, null)
    : null;
  const subFranchiseId =
    film.lowerFranchise && franchiseId
      ? createFranchise(film.lowerFranchise, franchiseId)
      : null;
  const inserted = tx
    .insert(films)
    .values({
      title: film.title,
      releaseYear: film.releaseYear,
      status: film.status,
      watchOrder: film.watchOrder,
      lastWatchDate: film.lastWatchDate,
      genrePrimary: film.genrePrimary,
      genreSecondary: film.genreSecondary,
      franchiseId,
      subFranchiseId,
      notes: film.notes,
    })
    .returning({ id: films.id })
    .get();

  if (film.scores) {
    tx.insert(ratings)
      .values({
        filmId: inserted.id,
        ...film.scores,
        quality: film.quality,
        overall: computeOverall(film.scores, weights),
        overallSecondary:
          film.quality === null
            ? null
            : computeSecondary(
                film.quality,
                film.scores.rewatchability,
                film.scores.genreFit,
              ),
      })
      .run();
  }
  if (film.lastWatchDate)
    tx.insert(watchLog)
      .values({
        filmId: inserted.id,
        watchedOn: film.lastWatchDate,
        isRewatch: false,
      })
      .run();
}
