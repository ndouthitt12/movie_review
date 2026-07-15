import type { Database } from "./index";
import {
  formSections,
  formVersions,
  questions,
  rcaTags,
  scaleLevels,
} from "./schema";
import { defaultRubric, starterRcaTags } from "./seed-data";

const questionSeeds = [
  { key: "story", label: "Story", weight: 5, offset: 0 },
  { key: "direction", label: "Direction", weight: 5, offset: 0 },
  { key: "writing", label: "Writing", weight: 5, offset: 0 },
  { key: "acting", label: "Acting", weight: 5, offset: 0 },
  { key: "music", label: "Music", weight: 2, offset: 0 },
  { key: "impact", label: "Impact", weight: 4, offset: 0 },
  {
    key: "rewatchability",
    label: "Rewatchability",
    weight: 10,
    offset: -50,
  },
  { key: "genre_fit", label: "Genre Fit", weight: 3, offset: 0 },
] as const;

export async function seedDatabase(database: Database) {
  await database.transaction(async (tx) => {
    const [existingVersion] = await tx
      .select({ id: formVersions.id })
      .from(formVersions)
      .limit(1);
    if (!existingVersion) await seedForm(tx);

    for (const row of defaultRubric) {
      await tx
        .insert(scaleLevels)
        .values({
          level: row.score,
          title: "",
          meaning: row.meaning,
          exampleFilms: row.examples.join(", "),
        })
        .onConflictDoNothing({ target: scaleLevels.level });
    }

    for (const [questionKey, label, polarity] of starterRcaTags) {
      await tx
        .insert(rcaTags)
        .values({ label, questionKey, polarity })
        .onConflictDoNothing({ target: [rcaTags.label, rcaTags.questionKey] });
    }
  });
}

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

async function seedForm(tx: Transaction) {
  const [version] = await tx
    .insert(formVersions)
    .values({
      label: "v1 — spreadsheet-era form",
      status: "published",
      divisorMode: "manual",
      manualDivisor: 334,
      secondaryDivisorMode: "manual",
      secondaryManualDivisor: 100,
      publishedAt: new Date().toISOString(),
    })
    .returning({ id: formVersions.id });
  if (!version) throw new Error("Could not seed the published form.");

  const [attributes] = await tx
    .insert(formSections)
    .values({ formVersionId: version.id, title: "Attributes", sortOrder: 0 })
    .returning({ id: formSections.id });
  const [quality] = await tx
    .insert(formSections)
    .values({
      formVersionId: version.id,
      title: "Quality (secondary)",
      sortOrder: 1,
    })
    .returning({ id: formSections.id });
  if (!attributes || !quality) throw new Error("Could not seed form sections.");

  for (const [sortOrder, question] of questionSeeds.entries()) {
    await tx.insert(questions).values({
      formVersionId: version.id,
      key: question.key,
      label: question.label,
      type: "slider",
      sectionId: attributes.id,
      sortOrder,
      required: true,
      scored: true,
      weight: question.weight,
      min: 0,
      max: 100,
      offset: question.offset,
      blankPolicy: "exclude_and_renormalize",
      allowNa: false,
      conditionLogic: "all",
      rcaEnabled: true,
      secondaryScored:
        question.key === "rewatchability" || question.key === "genre_fit",
      secondaryWeight:
        question.key === "rewatchability"
          ? 4
          : question.key === "genre_fit"
            ? 1
            : null,
    });
  }

  await tx.insert(questions).values({
    formVersionId: version.id,
    key: "quality",
    label: "Quality",
    type: "slider",
    sectionId: quality.id,
    sortOrder: questionSeeds.length,
    required: false,
    scored: false,
    weight: null,
    min: 0,
    max: 100,
    offset: 0,
    blankPolicy: "exclude_and_renormalize",
    allowNa: false,
    conditionLogic: "all",
    rcaEnabled: false,
    secondaryScored: true,
    secondaryWeight: 5,
  });
}
