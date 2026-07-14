import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import {
  answers,
  filmRcaTags,
  films,
  franchises,
  questionOptions,
  questions,
  ratings,
  rcaTags,
  scaleLevels,
  watchLog,
} from "@/db/schema";
import { getFormVersionConfig, getPublishedRuntimeForm } from "./form-config";
import type { DashboardFilm } from "./stats";

export async function getLibraryFilms() {
  const subFranchises = alias(franchises, "sub_franchises");
  const rows = await db
    .select({
      id: films.id,
      tmdbId: films.tmdbId,
      title: films.title,
      releaseYear: films.releaseYear,
      status: films.status,
      watchOrder: films.watchOrder,
      lastWatchDate: films.lastWatchDate,
      genrePrimary: films.genrePrimary,
      genreSecondary: films.genreSecondary,
      notes: films.notes,
      posterPath: films.posterPath,
      director: films.director,
      franchise: franchises.name,
      subFranchise: subFranchises.name,
      formVersionId: ratings.formVersionId,
      overall: ratings.overall,
    })
    .from(films)
    .leftJoin(ratings, eq(ratings.filmId, films.id))
    .leftJoin(franchises, eq(franchises.id, films.franchiseId))
    .leftJoin(subFranchises, eq(subFranchises.id, films.subFranchiseId))
    .orderBy(asc(films.watchOrder), asc(films.title));
  const tagRows = rows.length
    ? await db
        .select({
          filmId: filmRcaTags.filmId,
          id: rcaTags.id,
          label: rcaTags.label,
          attribute: rcaTags.questionKey,
          polarity: rcaTags.polarity,
          color: rcaTags.color,
        })
        .from(filmRcaTags)
        .innerJoin(rcaTags, eq(rcaTags.id, filmRcaTags.rcaTagId))
        .where(
          inArray(
            filmRcaTags.filmId,
            rows.map(({ id }) => id),
          ),
        )
        .orderBy(asc(rcaTags.label))
    : [];
  const tagsByFilm = new Map<number, typeof tagRows>();
  for (const tag of tagRows) {
    const list = tagsByFilm.get(tag.filmId) ?? [];
    list.push(tag);
    tagsByFilm.set(tag.filmId, list);
  }
  const scoresByFilm = await loadNumericAnswers(rows.map(({ id }) => id));
  return rows.map((film) => {
    const scores = scoresByFilm.get(film.id) ?? new Map<string, number>();
    return {
      ...film,
      story: scores.get("story") ?? null,
      direction: scores.get("direction") ?? null,
      writing: scores.get("writing") ?? null,
      acting: scores.get("acting") ?? null,
      music: scores.get("music") ?? null,
      impact: scores.get("impact") ?? null,
      rewatchability: scores.get("rewatchability") ?? null,
      genreFit: scores.get("genre_fit") ?? null,
      rcaTags: (tagsByFilm.get(film.id) ?? []).map(
      ({ id, label, attribute, polarity, color }) => ({
        id,
        label,
        attribute,
        polarity,
        color,
      }),
      ),
    };
  });
}

export type LibraryFilm = Awaited<ReturnType<typeof getLibraryFilms>>[number];

export async function getCatalogOptions() {
  const filmRows = await db
    .select({ primary: films.genrePrimary, secondary: films.genreSecondary })
    .from(films);
  const genreSet = new Set<string>();
  filmRows.forEach(({ primary, secondary }) => {
    if (primary) genreSet.add(primary);
    if (secondary) genreSet.add(secondary);
  });
  return {
    genres: [...genreSet].sort(),
    franchises: await db
      .select({
        id: franchises.id,
        name: franchises.name,
        parentId: franchises.parentId,
      })
      .from(franchises)
      .orderBy(asc(franchises.name)),
  };
}

export async function getFilmDetail(id: number) {
  const [film] = await db.select().from(films).where(eq(films.id, id)).limit(1);
  if (!film) return null;
  const [ratingRow] = await db
    .select()
    .from(ratings)
    .where(eq(ratings.filmId, id))
    .limit(1);
  const rating = ratingRow ?? null;
  const watches = await db
    .select()
    .from(watchLog)
    .where(eq(watchLog.filmId, id))
    .orderBy(desc(watchLog.watchedOn), desc(watchLog.id));
  const form = rating ? await getFormVersionConfig(rating.formVersionId) : null;
  const questionIds = form?.questions.map(({ id: questionId }) => questionId) ?? [];
  const answerRows = questionIds.length
    ? await db
        .select()
        .from(answers)
        .where(
          and(
            eq(answers.filmId, id),
            inArray(answers.questionId, questionIds),
          ),
        )
    : [];
  const selectedRcaTags = await db
    .select({
      id: rcaTags.id,
      label: rcaTags.label,
      questionKey: rcaTags.questionKey,
      polarity: rcaTags.polarity,
      color: rcaTags.color,
    })
    .from(filmRcaTags)
    .innerJoin(rcaTags, eq(rcaTags.id, filmRcaTags.rcaTagId))
    .where(eq(filmRcaTags.filmId, id))
    .orderBy(asc(rcaTags.questionKey), asc(rcaTags.label));
  return {
    film,
    rating,
    answers: answerRows,
    form,
    watches,
    selectedRcaTags,
  };
}

export async function getDashboardData() {
  const publishedForm = await getPublishedRuntimeForm();
  const attributes = (publishedForm?.questions ?? [])
    .filter(
      (question) =>
        question.scored &&
        question.type !== "short_text" &&
        question.type !== "paragraph",
    )
    .map(({ key, label }) => ({ key, label }));
  const subFranchises = alias(franchises, "dashboard_sub_franchises");
  const filmRows = await db
    .select({
      id: films.id,
      title: films.title,
      releaseYear: films.releaseYear,
      status: films.status,
      genrePrimary: films.genrePrimary,
      genreSecondary: films.genreSecondary,
      franchise: franchises.name,
      subFranchise: subFranchises.name,
      overall: ratings.overall,
    })
    .from(films)
    .leftJoin(ratings, eq(ratings.filmId, films.id))
    .leftJoin(franchises, eq(franchises.id, films.franchiseId))
    .leftJoin(subFranchises, eq(subFranchises.id, films.subFranchiseId));
  const tagRows = await db
    .select({
      filmId: filmRcaTags.filmId,
      id: rcaTags.id,
      label: rcaTags.label,
      questionKey: rcaTags.questionKey,
    })
    .from(filmRcaTags)
    .innerJoin(rcaTags, eq(rcaTags.id, filmRcaTags.rcaTagId));
  const tagsByFilm = new Map<number, DashboardFilm["rcaTags"]>();
  for (const tag of tagRows) {
    const list = tagsByFilm.get(tag.filmId) ?? [];
    list.push({
      id: tag.id,
      label: tag.label,
      questionKey: tag.questionKey,
    });
    tagsByFilm.set(tag.filmId, list);
  }
  const scoresByFilm = await loadDashboardScores(
    filmRows.map(({ id }) => id),
    new Set(attributes.map(({ key }) => key)),
  );
  const dashboardFilms: DashboardFilm[] = filmRows.map((film) => {
    const values = scoresByFilm.get(film.id) ?? {};
    const rating =
      film.overall === null
        ? null
        : {
            values,
            overall: film.overall,
          };
    return { ...film, rating, rcaTags: tagsByFilm.get(film.id) ?? [] };
  });
  const watches = await db
    .select({
      filmId: watchLog.filmId,
      watchedOn: watchLog.watchedOn,
      title: films.title,
    })
    .from(watchLog)
    .innerJoin(films, eq(films.id, watchLog.filmId))
    .orderBy(asc(watchLog.watchedOn), asc(watchLog.id));
  return { films: dashboardFilms, watches, attributes };
}

export async function getRubric() {
  return db.select().from(scaleLevels).orderBy(desc(scaleLevels.level));
}

async function loadNumericAnswers(filmIds: number[]) {
  if (filmIds.length === 0) return new Map<number, Map<string, number>>();
  const rows = await db
    .select({
      filmId: answers.filmId,
      questionId: answers.questionId,
      valueNumber: answers.valueNumber,
    })
    .from(answers)
    .where(inArray(answers.filmId, filmIds));
  const questionKeys = new Map(
    (await db
      .select({ id: questions.id, key: questions.key })
      .from(questions))
      .map(({ id, key }) => [id, key]),
  );
  const byFilm = new Map<number, Map<string, number>>();
  for (const row of rows) {
    const key = questionKeys.get(row.questionId);
    if (!key || row.valueNumber == null) continue;
    const values = byFilm.get(row.filmId) ?? new Map<string, number>();
    values.set(key, row.valueNumber);
    byFilm.set(row.filmId, values);
  }
  return byFilm;
}

async function loadDashboardScores(filmIds: number[], publishedKeys: Set<string>) {
  if (!filmIds.length || !publishedKeys.size)
    return new Map<number, Record<string, number>>();
  const rows = await db
    .select({
      filmId: answers.filmId,
      questionId: answers.questionId,
      valueNumber: answers.valueNumber,
      valueOptionIds: answers.valueOptionIds,
      isNa: answers.isNa,
    })
    .from(answers)
    .where(inArray(answers.filmId, filmIds));
  const questionIds = [...new Set(rows.map(({ questionId }) => questionId))];
  const questionById = new Map(
    questionIds.length
      ? (await db
          .select({
            id: questions.id,
            key: questions.key,
            type: questions.type,
            multiSelectScoring: questions.multiSelectScoring,
          })
          .from(questions)
          .where(inArray(questions.id, questionIds)))
          .map((question) => [question.id, question] as const)
      : [],
  );
  const selectedOptionIds = [
    ...new Set(rows.flatMap(({ valueOptionIds }) => valueOptionIds ?? [])),
  ];
  const optionScores = new Map(
    selectedOptionIds.length
      ? (await db
          .select({ id: questionOptions.id, valueScore: questionOptions.valueScore, isNull: questionOptions.isNull })
          .from(questionOptions)
          .where(inArray(questionOptions.id, selectedOptionIds)))
          .map((option) => [option.id, option] as const)
      : [],
  );
  const byFilm = new Map<number, Record<string, number>>();
  for (const row of rows) {
    if (row.isNa) continue;
    const question = questionById.get(row.questionId);
    if (!question || !publishedKeys.has(question.key)) continue;
    let score = row.valueNumber;
    if (score == null && row.valueOptionIds?.length) {
      const selected = row.valueOptionIds
        .map((id) => optionScores.get(id))
        .filter((option) => option && !option.isNull && option.valueScore != null)
        .map((option) => option!.valueScore!);
      if (selected.length)
        score =
          question.type === "multi_select" && question.multiSelectScoring === "sum"
            ? selected.reduce((sum, value) => sum + value, 0)
            : selected.reduce((sum, value) => sum + value, 0) / selected.length;
    }
    if (score == null) continue;
    const values = byFilm.get(row.filmId) ?? {};
    values[question.key] = score;
    byFilm.set(row.filmId, values);
  }
  return byFilm;
}
