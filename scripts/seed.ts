import "dotenv/config";
import { createDb } from "../src/db";
import { defaultRubric, starterRcaTags } from "../src/db/seed-data";

const questions = [
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

const { sqlite } = createDb();
try {
  sqlite.transaction(() => {
    const versionCount = (
      sqlite.prepare("select count(*) as count from form_versions").get() as {
        count: number;
      }
    ).count;
    if (versionCount === 0) seedForm();

    const insertLevel = sqlite.prepare(
      `insert into scale_levels (level, title, meaning, example_films)
       values (?, '', ?, ?) on conflict(level) do nothing`,
    );
    for (const row of defaultRubric)
      insertLevel.run(row.score, row.meaning, row.examples.join(", "));

    const rcaColumns = sqlite
      .prepare("pragma table_info(rca_tags)")
      .all() as Array<{ name: string }>;
    const keyColumn = rcaColumns.some(({ name }) => name === "question_key")
      ? "question_key"
      : "attribute";
    const insertTag = sqlite.prepare(
      `insert or ignore into rca_tags (label, ${keyColumn}, polarity)
       values (?, ?, ?)`,
    );
    for (const [questionKey, label, polarity] of starterRcaTags)
      insertTag.run(label, questionKey, polarity);
  })();
  console.log("Form v1, rating scale, and RCA tags seeded.");
} finally {
  sqlite.close();
}

function seedForm() {
  sqlite
    .prepare(
      `insert into form_versions
       (id, label, status, divisor_mode, manual_divisor, published_at)
       values (1, ?, 'published', 'manual', 334, CURRENT_TIMESTAMP)`,
    )
    .run("v1 — spreadsheet-era form");
  const insertSection = sqlite.prepare(
    "insert into form_sections (form_version_id, title, sort_order) values (1, ?, ?)",
  );
  const attributesSectionId = Number(
    insertSection.run("Attributes", 0).lastInsertRowid,
  );
  const qualitySectionId = Number(
    insertSection.run("Quality (secondary)", 1).lastInsertRowid,
  );
  const insertQuestion = sqlite.prepare(
    `insert into questions
     (form_version_id, key, label, type, section_id, sort_order, required,
      scored, weight, min, max, offset, blank_policy, allow_na,
      condition_logic, rca_enabled)
     values (1, @key, @label, 'slider', @sectionId, @sortOrder, @required,
      @scored, @weight, 0, 100, @offset, 'exclude_and_renormalize', 0,
      'all', @rcaEnabled)`,
  );
  questions.forEach((question, sortOrder) =>
    insertQuestion.run({
      ...question,
      sectionId: attributesSectionId,
      sortOrder,
      required: 1,
      scored: 1,
      rcaEnabled: 1,
    }),
  );
  insertQuestion.run({
    key: "quality",
    label: "Quality",
    sectionId: qualitySectionId,
    sortOrder: questions.length,
    required: 0,
    scored: 0,
    weight: null,
    offset: 0,
    rcaEnabled: 0,
  });
  sqlite
    .prepare(
      `update form_versions
       set secondary_divisor_mode = 'manual', secondary_manual_divisor = 100
       where id = 1`,
    )
    .run();
  const setSecondaryTerm = sqlite.prepare(
    `update questions
     set secondary_scored = 1, secondary_weight = ?
     where form_version_id = 1 and key = ?`,
  );
  setSecondaryTerm.run(5, "quality");
  setSecondaryTerm.run(4, "rewatchability");
  setSecondaryTerm.run(1, "genre_fit");
}
