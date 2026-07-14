import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { createDb } from "../src/db";
import { defaultWeights } from "../src/db/seed-data";
import { films, franchises, watchLog } from "../src/db/schema";
import {
  computeOverall,
  computeSecondary,
} from "../src/lib/scoring";
import {
  importedAnswerValues,
  parseWorkbook,
  verifyImport,
  v1AnswerKeys,
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
  const connection = dryRun ? null : createDb();

  try {
    const verification = verifyImport(parsed.films, defaultWeights);
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
      "Weights: canonical spreadsheet v1 configuration",
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

    const { db, sqlite } = connection!;
    const form = loadV1Form(sqlite);
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
        insertFilm(tx, sqlite, film, form, createFranchise);

      const filmCount = tx.select({ id: films.id }).from(films).all().length;
      const ratingCount = (
        sqlite.prepare("select count(*) as count from ratings").get() as {
          count: number;
        }
      ).count;
      const answerCount = (
        sqlite.prepare("select count(*) as count from answers").get() as {
          count: number;
        }
      ).count;
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
      const expectedAnswers = parsed.films.reduce(
        (count, film) => count + importedAnswerValues(film).length,
        0,
      );
      if (
        filmCount !== parsed.films.length ||
        ratingCount !== expectedRatings ||
        watchCount !== expectedWatches ||
        answerCount !== expectedAnswers
      )
        throw new Error(
          "Persisted film/rating/answer/watch counts failed verification; transaction rolled back.",
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

type AppDb = ReturnType<typeof createDb>["db"];
type Transaction = Parameters<Parameters<AppDb["transaction"]>[0]>[0];
type V1Form = { id: number; questionIds: Map<string, number> };

function insertFilm(
  tx: Transaction,
  sqlite: import("better-sqlite3").Database,
  film: ImportedFilm,
  form: V1Form,
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
    const insertAnswer = sqlite.prepare(
      `insert into answers (film_id, question_id, value_number, is_na)
       values (?, ?, ?, 0)`,
    );
    for (const answer of importedAnswerValues(film)) {
      const questionId = form.questionIds.get(answer.key);
      if (!questionId)
        throw new Error(`Published v1 form is missing question ${answer.key}.`);
      insertAnswer.run(inserted.id, questionId, answer.valueNumber);
    }
    sqlite
      .prepare(
        `insert into ratings
         (film_id, form_version_id, overall, overall_secondary)
         values (?, ?, ?, ?)`,
      )
      .run(
        inserted.id,
        form.id,
        computeOverall(film.scores, defaultWeights),
        film.quality === null
          ? null
          : computeSecondary(
              film.quality,
              film.scores.rewatchability,
              film.scores.genreFit,
            ),
      );
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

function loadV1Form(sqlite: import("better-sqlite3").Database): V1Form {
  const ratingColumns = sqlite
    .prepare("pragma table_info(ratings)")
    .all() as Array<{ name: string }>;
  if (!ratingColumns.some(({ name }) => name === "form_version_id")) {
    throw new Error(
      "Forms migration has not been applied. Run npm run db:forms-migrate before importing.",
    );
  }
  const version = sqlite
    .prepare(
      "select id from form_versions where status = 'published' order by id desc limit 1",
    )
    .get() as { id: number } | undefined;
  if (!version)
    throw new Error("A published form is required before importing films.");
  const rows = sqlite
    .prepare(
      "select id, key from questions where form_version_id = ? and archived_at is null",
    )
    .all(version.id) as Array<{ id: number; key: string }>;
  const questionIds = new Map(rows.map(({ id, key }) => [key, id]));
  const missing = v1AnswerKeys.filter((key) => !questionIds.has(key));
  if (missing.length > 0)
    throw new Error(
      `Published form is missing v1 import questions: ${missing.join(", ")}.`,
    );
  return { id: version.id, questionIds };
}
