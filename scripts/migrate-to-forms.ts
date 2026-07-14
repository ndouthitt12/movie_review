import "dotenv/config";
import { createDb } from "../src/db";
import { defaultRubric } from "../src/db/seed-data";
import {
  computeOverallFromForm,
  type AnswerMap,
  type FormConfig,
  type QuestionConfig,
} from "../src/lib/scoring";

type LegacyRating = {
  id: number;
  film_id: number;
  story: number;
  direction: number;
  writing: number;
  acting: number;
  music: number;
  impact: number;
  rewatchability: number;
  genre_fit: number;
  quality: number | null;
  overall: number;
  overall_secondary: number | null;
  rated_at: string;
};

type RubricRow = { score: number; meaning: string; examples: string[] };

const primaryQuestions = [
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
  const existingVersions = sqlite
    .prepare("select count(*) as count from form_versions")
    .get() as { count: number };
  if (existingVersions.count > 0) {
    console.log(
      `Forms migration skipped: form_versions already contains ${existingVersions.count} row(s).`,
    );
  } else {
    const report = sqlite.transaction(() => migrate())();
    console.log("Forms migration verification passed.");
    console.log(`Films checked: ${report.filmsChecked}`);
    console.log(`Maximum overall difference: ${report.maxDiff.toFixed(12)}`);
    console.log(`Answers written: ${report.answersWritten}`);
    console.log(`RCA tags preserved: ${report.rcaTagsPreserved}`);
    console.log(`Scale levels written: ${report.scaleLevelsWritten}`);
  }
} finally {
  sqlite.close();
}

function migrate() {
  const legacyRatings = sqlite
    .prepare("select * from ratings order by id")
    .all() as LegacyRating[];
  const originalRcaCount = (
    sqlite.prepare("select count(*) as count from rca_tags").get() as {
      count: number;
    }
  ).count;
  const rcaLinks = sqlite
    .prepare("select film_id, rca_tag_id from film_rca_tags")
    .all() as Array<{ film_id: number; rca_tag_id: number }>;

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
  const questionIds = new Map<string, number>();
  primaryQuestions.forEach((question, sortOrder) => {
    const result = insertQuestion.run({
      ...question,
      sectionId: attributesSectionId,
      sortOrder,
      required: 1,
      scored: 1,
      rcaEnabled: 1,
    });
    questionIds.set(question.key, Number(result.lastInsertRowid));
  });
  const qualityResult = insertQuestion.run({
    key: "quality",
    label: "Quality",
    sectionId: qualitySectionId,
    sortOrder: primaryQuestions.length,
    required: 0,
    scored: 0,
    weight: null,
    offset: 0,
    rcaEnabled: 0,
  });
  questionIds.set("quality", Number(qualityResult.lastInsertRowid));
  sqlite
    .prepare(
      `update form_versions
       set secondary_divisor_mode = 'manual', secondary_manual_divisor = 100
       where id = 1`,
    )
    .run();
  const setSecondaryTerm = sqlite.prepare(
    `update questions
     set secondary_scored = 1, secondary_weight = ?, secondary_offset = 0
     where form_version_id = 1 and key = ?`,
  );
  setSecondaryTerm.run(5, "quality");
  setSecondaryTerm.run(4, "rewatchability");
  setSecondaryTerm.run(1, "genre_fit");

  const insertAnswer = sqlite.prepare(
    `insert into answers (film_id, question_id, value_number, is_na)
     values (?, ?, ?, 0)`,
  );
  for (const rating of legacyRatings) {
    for (const question of primaryQuestions) {
      insertAnswer.run(
        rating.film_id,
        requiredQuestionId(questionIds, question.key),
        rating[question.key],
      );
    }
    if (rating.quality != null) {
      insertAnswer.run(
        rating.film_id,
        requiredQuestionId(questionIds, "quality"),
        rating.quality,
      );
    }
  }

  sqlite.exec(`
    create table ratings_new (
      id integer primary key autoincrement not null,
      film_id integer not null,
      form_version_id integer not null,
      overall real not null,
      overall_secondary real,
      rated_at text default CURRENT_TIMESTAMP not null,
      foreign key (film_id) references films(id) on delete cascade,
      foreign key (form_version_id) references form_versions(id)
    );
  `);
  const insertRating = sqlite.prepare(
    `insert into ratings_new
     (id, film_id, form_version_id, overall, overall_secondary, rated_at)
     values (?, ?, 1, ?, ?, ?)`,
  );
  for (const rating of legacyRatings) {
    insertRating.run(
      rating.id,
      rating.film_id,
      rating.overall,
      rating.overall_secondary,
      rating.rated_at,
    );
  }
  sqlite.exec(`
    drop table ratings;
    alter table ratings_new rename to ratings;
    create unique index ratings_film_id_unique on ratings (film_id);
    create index ratings_overall_idx on ratings (overall);
  `);

  sqlite.exec(`
    create table rca_tags_new (
      id integer primary key autoincrement not null,
      label text not null,
      question_key text not null,
      polarity text not null,
      color text,
      constraint rca_tags_polarity_check
        check (polarity in ('positive','negative','neutral'))
    );
    insert into rca_tags_new (id, label, question_key, polarity, color)
      select id, label, attribute, polarity, color from rca_tags;
    drop table film_rca_tags;
    drop table rca_tags;
    alter table rca_tags_new rename to rca_tags;
    create unique index rca_tags_label_question_key_unique
      on rca_tags (label, question_key);
    create table film_rca_tags (
      film_id integer not null,
      rca_tag_id integer not null,
      primary key (film_id, rca_tag_id),
      foreign key (film_id) references films(id) on delete cascade,
      foreign key (rca_tag_id) references rca_tags(id) on delete cascade
    );
  `);
  const insertRcaLink = sqlite.prepare(
    "insert into film_rca_tags (film_id, rca_tag_id) values (?, ?)",
  );
  rcaLinks.forEach(({ film_id, rca_tag_id }) =>
    insertRcaLink.run(film_id, rca_tag_id),
  );

  const rubric = readRubric();
  const insertScaleLevel = sqlite.prepare(
    `insert into scale_levels (level, title, meaning, example_films)
     values (?, '', ?, ?)`,
  );
  for (let level = 0; level <= 10; level++) {
    const source = rubric.find((row) => row.score === level);
    if (!source) throw new Error(`Rubric is missing scale level ${level}.`);
    insertScaleLevel.run(level, source.meaning, source.examples.join(", "));
  }

  const configQuestions: QuestionConfig[] = primaryQuestions.map(
    (question) => ({
      id: requiredQuestionId(questionIds, question.key),
      key: question.key,
      type: "slider",
      required: true,
      scored: true,
      weight: question.weight,
      min: 0,
      max: 100,
      offset: question.offset,
      blankPolicy: "exclude_and_renormalize",
      multiSelectScoring: null,
      allowNa: false,
      conditionLogic: "all",
      conditions: [],
      options: [],
    }),
  );
  const form: FormConfig = {
    divisorMode: "manual",
    manualDivisor: 334,
    questions: configQuestions,
  };
  let maxDiff = 0;
  for (const rating of legacyRatings) {
    const answers: AnswerMap = Object.fromEntries(
      primaryQuestions.map((question) => [
        requiredQuestionId(questionIds, question.key),
        { number: rating[question.key] },
      ]),
    );
    const recomputed = computeOverallFromForm(form, answers).overall;
    const diff = Math.abs(recomputed - rating.overall);
    maxDiff = Math.max(maxDiff, diff);
    if (!(diff < 5e-4)) {
      throw new Error(
        `Film ${rating.film_id} overall verification failed: stored=${rating.overall}, recomputed=${recomputed}, diff=${diff}.`,
      );
    }
  }

  const expectedAnswers =
    legacyRatings.length * primaryQuestions.length +
    legacyRatings.filter(({ quality }) => quality != null).length;
  const answersWritten = (
    sqlite.prepare("select count(*) as count from answers").get() as {
      count: number;
    }
  ).count;
  if (answersWritten !== expectedAnswers) {
    throw new Error(
      `Answer count verification failed: expected ${expectedAnswers}, found ${answersWritten}.`,
    );
  }
  const rcaTagsPreserved = (
    sqlite.prepare("select count(*) as count from rca_tags").get() as {
      count: number;
    }
  ).count;
  if (rcaTagsPreserved !== originalRcaCount) {
    throw new Error(
      `RCA tag count verification failed: expected ${originalRcaCount}, found ${rcaTagsPreserved}.`,
    );
  }
  const scaleLevelsWritten = (
    sqlite.prepare("select count(*) as count from scale_levels").get() as {
      count: number;
    }
  ).count;
  if (scaleLevelsWritten !== 11) {
    throw new Error(
      `Scale level verification failed: expected 11, found ${scaleLevelsWritten}.`,
    );
  }
  const foreignKeyFailures = sqlite.prepare("pragma foreign_key_check").all();
  if (foreignKeyFailures.length > 0) {
    throw new Error(
      `Foreign-key verification failed with ${foreignKeyFailures.length} violation(s).`,
    );
  }

  return {
    filmsChecked: legacyRatings.length,
    maxDiff,
    answersWritten,
    rcaTagsPreserved,
    scaleLevelsWritten,
  };
}

function readRubric(): RubricRow[] {
  const setting = sqlite
    .prepare("select rubric from settings where id = 1")
    .get() as { rubric: string } | undefined;
  if (!setting) return defaultRubric.map((row) => ({ ...row, examples: [] }));
  const parsed = JSON.parse(setting.rubric) as unknown;
  if (!Array.isArray(parsed)) throw new Error("Stored rubric is not an array.");
  return parsed as RubricRow[];
}

function requiredQuestionId(ids: Map<string, number>, key: string) {
  const id = ids.get(key);
  if (!id) throw new Error(`Question id missing for ${key}.`);
  return id;
}
