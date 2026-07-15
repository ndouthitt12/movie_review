import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { and, count, desc, eq, isNull } from "drizzle-orm";
import { db } from "../src/db";
import { defaultWeights } from "../src/db/seed-data";
import {
  answers,
  films,
  formVersions,
  franchises,
  questions,
  ratings,
  watchLog,
} from "../src/db/schema";
import { computeOverall, computeSecondary } from "../src/lib/scoring";
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
  console.log("Weights: canonical spreadsheet v1 configuration");
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
    ([status, expectedCount]) =>
      verification.counts[status as keyof typeof expected] !== expectedCount,
  );
  if (countFailures.length) {
    for (const [status, expectedCount] of countFailures)
      console.error(
        `! ${status}: found ${verification.counts[status as keyof typeof expected]}, expected ${expectedCount}`,
      );
    throw new Error(
      "Import aborted because source-of-truth status counts do not match.",
    );
  }

  if (dryRun) {
    console.log("Verification passed. No database changes were made.");
    return;
  }

  const form = await loadV1Form();
  const existing = await db.select({ id: films.id }).from(films).limit(1);
  if (existing.length) {
    throw new Error(
      "Import requires an empty films table to prevent duplicates.",
    );
  }

  const importedCount = await db.transaction(async (tx) => {
    const franchiseIds = new Map<string, number>();
    const createFranchise = async (name: string, parentId: number | null) => {
      const key = `${parentId ?? "root"}:${name.toLowerCase()}`;
      const cached = franchiseIds.get(key);
      if (cached) return cached;
      const [row] = await tx
        .insert(franchises)
        .values({ name, parentId })
        .returning({ id: franchises.id });
      if (!row) throw new Error(`Could not create franchise ${name}.`);
      franchiseIds.set(key, row.id);
      return row.id;
    };

    for (const film of parsed.films) {
      await insertFilm(tx, film, form, createFranchise);
    }

    const [{ value: filmCount }] = await tx
      .select({ value: count() })
      .from(films);
    const [{ value: ratingCount }] = await tx
      .select({ value: count() })
      .from(ratings);
    const [{ value: answerCount }] = await tx
      .select({ value: count() })
      .from(answers);
    const [{ value: watchCount }] = await tx
      .select({ value: count() })
      .from(watchLog);
    const expectedRatings = parsed.films.filter(
      (film) => film.scores !== null,
    ).length;
    const expectedWatches = parsed.films.filter(
      (film) => film.lastWatchDate !== null,
    ).length;
    const expectedAnswers = parsed.films.reduce(
      (answerTotal, film) => answerTotal + importedAnswerValues(film).length,
      0,
    );
    if (
      filmCount !== parsed.films.length ||
      ratingCount !== expectedRatings ||
      watchCount !== expectedWatches ||
      answerCount !== expectedAnswers
    ) {
      throw new Error(
        "Persisted film/rating/answer/watch counts failed verification; transaction rolled back.",
      );
    }
    return filmCount;
  });

  console.log(
    `Import committed. ${importedCount} films written; all verification checks passed.`,
  );
}

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type V1Form = { id: number; questionIds: Map<string, number> };

async function insertFilm(
  tx: Transaction,
  film: ImportedFilm,
  form: V1Form,
  createFranchise: (name: string, parentId: number | null) => Promise<number>,
) {
  const franchiseId = film.upperFranchise
    ? await createFranchise(film.upperFranchise, null)
    : null;
  const subFranchiseId =
    film.lowerFranchise && franchiseId
      ? await createFranchise(film.lowerFranchise, franchiseId)
      : null;
  const [inserted] = await tx
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
    .returning({ id: films.id });
  if (!inserted) throw new Error(`Could not import ${film.title}.`);

  if (film.scores) {
    const answerRows = importedAnswerValues(film).map((answer) => {
      const questionId = form.questionIds.get(answer.key);
      if (!questionId) {
        throw new Error(`Published v1 form is missing question ${answer.key}.`);
      }
      return {
        filmId: inserted.id,
        questionId,
        valueNumber: answer.valueNumber,
        isNa: false,
      };
    });
    if (answerRows.length) await tx.insert(answers).values(answerRows);
    await tx.insert(ratings).values({
      filmId: inserted.id,
      formVersionId: form.id,
      overall: computeOverall(film.scores, defaultWeights),
      overallSecondary:
        film.quality === null
          ? null
          : computeSecondary(
              film.quality,
              film.scores.rewatchability,
              film.scores.genreFit,
            ),
    });
  }
  if (film.lastWatchDate) {
    await tx.insert(watchLog).values({
      filmId: inserted.id,
      watchedOn: film.lastWatchDate,
      isRewatch: false,
    });
  }
}

async function loadV1Form(): Promise<V1Form> {
  const [version] = await db
    .select({ id: formVersions.id })
    .from(formVersions)
    .where(eq(formVersions.status, "published"))
    .orderBy(desc(formVersions.id))
    .limit(1);
  if (!version) {
    throw new Error(
      "A published form is required before importing films. Run npm run db:seed first.",
    );
  }
  const rows = await db
    .select({ id: questions.id, key: questions.key })
    .from(questions)
    .where(
      and(
        eq(questions.formVersionId, version.id),
        isNull(questions.archivedAt),
      ),
    );
  const questionIds = new Map(rows.map(({ id, key }) => [key, id]));
  const missing = v1AnswerKeys.filter((key) => !questionIds.has(key));
  if (missing.length > 0) {
    throw new Error(
      `Published form is missing v1 import questions: ${missing.join(", ")}.`,
    );
  }
  return { id: version.id, questionIds };
}
