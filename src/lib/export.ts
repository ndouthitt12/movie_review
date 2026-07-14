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

export function buildJsonExport() {
  return {
    exported_at: new Date().toISOString(),
    films: db.select().from(films).all(),
    ratings: db.select().from(ratings).all(),
    watch_log: db.select().from(watchLog).all(),
    franchises: db.select().from(franchises).all(),
    rca_tags: db.select().from(rcaTags).all(),
    film_rca_tags: db.select().from(filmRcaTags).all(),
    form_versions: db.select().from(formVersions).all(),
    form_sections: db.select().from(formSections).all(),
    questions: db.select().from(questions).all(),
    question_options: db.select().from(questionOptions).all(),
    question_conditions: db.select().from(questionConditions).all(),
    answers: db.select().from(answers).all(),
    scale_levels: db.select().from(scaleLevels).orderBy(asc(scaleLevels.level)).all(),
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

export function buildCsvExport() {
  const filmRows = db.select().from(films).orderBy(asc(films.id)).all();
  const ratingRows = db.select().from(ratings).all();
  const franchiseRows = new Map(db.select().from(franchises).all().map((row) => [row.id, row.name]));
  const answerRows = db.select().from(answers).all();
  const questionRows = new Map(db.select().from(questions).all().map((row) => [row.id, row]));
  const optionRows = new Map(db.select().from(questionOptions).all().map((row) => [row.id, row]));
  const published = getPublishedRuntimeForm();
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
