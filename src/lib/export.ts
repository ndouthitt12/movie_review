import { asc } from "drizzle-orm";
import { db } from "@/db";
import {
  answers,
  filmRcaTags,
  films,
  formSections,
  formVersions,
  franchises,
  questionConditions,
  questionOptions,
  questions,
  ratings,
  rcaTags,
  scaleLevels,
  watchLog,
} from "@/db/schema";
import { getPublishedRuntimeForm } from "./form-config";

export async function buildJsonExport() {
  return {
    exported_at: new Date().toISOString(),
    films: await db.select().from(films),
    ratings: await db.select().from(ratings),
    watch_log: await db.select().from(watchLog),
    franchises: await db.select().from(franchises),
    rca_tags: await db.select().from(rcaTags),
    film_rca_tags: await db.select().from(filmRcaTags),
    form_versions: await db.select().from(formVersions),
    form_sections: await db.select().from(formSections),
    questions: await db.select().from(questions),
    question_options: await db.select().from(questionOptions),
    question_conditions: await db.select().from(questionConditions),
    answers: await db.select().from(answers),
    scale_levels: await db.select().from(scaleLevels).orderBy(asc(scaleLevels.level)),
  };
}

const v1Columns = [
  ["story", "Story"],
  ["direction", "Direction"],
  ["writing", "Writing"],
  ["acting", "Acting"],
  ["music", "Music"],
  ["impact", "Impact"],
  ["rewatchability", "Rewatchability"],
  ["genre_fit", "Genre Fit"],
  ["quality", "Quality"],
] as const;

export async function buildCsvExport() {
  const filmRows = await db.select().from(films).orderBy(asc(films.id));
  const ratingRows = await db.select().from(ratings);
  const franchiseRows = new Map((await db.select().from(franchises)).map((row) => [row.id, row.name]));
  const answerRows = await db.select().from(answers);
  const questionRows = new Map((await db.select().from(questions)).map((row) => [row.id, row]));
  const optionRows = new Map((await db.select().from(questionOptions)).map((row) => [row.id, row]));
  const published = await getPublishedRuntimeForm();
  const v1Keys = new Set(v1Columns.map(([key]) => key));
  const customQuestions = (published?.questions ?? []).filter(({ key }) => !v1Keys.has(key as (typeof v1Columns)[number][0]));
  const headers = [
    "Movie Title", "Release Year", "Category", "ToWatchOrder", "Last Watch Date", "Genre",
    "Upper Franchise", "Lower Franchise I", "Notes", ...v1Columns.map(([, header]) => header),
    ...customQuestions.map(({ label }) => label), "Overall", "Overall Secondary", "Ranking",
  ];
  const ranked = ratingRows.map(({ overall }) => overall).sort((a, b) => b - a);

  const rows = filmRows.map((film) => {
    const rating = ratingRows.find(({ filmId }) => filmId === film.id);
    const values = new Map<string, string | number>();
    for (const answer of answerRows.filter(({ filmId }) => filmId === film.id)) {
      const question = questionRows.get(answer.questionId);
      if (!question) continue;
      let value: string | number = "";
      if (answer.isNa) value = "N/A";
      else if (answer.valueNumber != null) value = answer.valueNumber;
      else if (answer.valueText) value = answer.valueText;
      else if (answer.valueOptionIds?.length)
        value = answer.valueOptionIds.map((id) => optionRows.get(id)?.label).filter(Boolean).join(" | ");
      values.set(question.key, value);
    }
    return [
      film.title,
      film.releaseYear,
      film.status,
      film.watchOrder ?? "",
      film.lastWatchDate ?? "",
      [film.genrePrimary, film.genreSecondary].filter(Boolean).join(" - "),
      film.franchiseId ? (franchiseRows.get(film.franchiseId) ?? "") : "",
      film.subFranchiseId ? (franchiseRows.get(film.subFranchiseId) ?? "") : "",
      film.notes,
      ...v1Columns.map(([key]) => values.get(key) ?? ""),
      ...customQuestions.map(({ key }) => values.get(key) ?? ""),
      rating?.overall ?? "",
      rating?.overallSecondary ?? "",
      rating ? ranked.indexOf(rating.overall) + 1 : "",
    ];
  });
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
}

function csvCell(value: string | number) {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
