import { asc, desc, eq, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { db } from "@/db";
import {
  filmRcaTags,
  films,
  franchises,
  ratings,
  rcaTags,
  settings,
  watchLog,
} from "@/db/schema";
import { defaultWeights } from "@/db/seed-data";
import type { RatingWeights } from "./scoring";

export async function getLibraryFilms() {
  const subFranchises = alias(franchises, "sub_franchises");
  const rows = db
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
      story: ratings.story,
      direction: ratings.direction,
      writing: ratings.writing,
      acting: ratings.acting,
      music: ratings.music,
      impact: ratings.impact,
      rewatchability: ratings.rewatchability,
      genreFit: ratings.genreFit,
      overall: ratings.overall,
    })
    .from(films)
    .leftJoin(ratings, eq(ratings.filmId, films.id))
    .leftJoin(franchises, eq(franchises.id, films.franchiseId))
    .leftJoin(subFranchises, eq(subFranchises.id, films.subFranchiseId))
    .orderBy(asc(films.watchOrder), asc(films.title))
    .all();
  const tagRows = rows.length
    ? db
        .select({
          filmId: filmRcaTags.filmId,
          id: rcaTags.id,
          label: rcaTags.label,
          attribute: rcaTags.attribute,
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
        .all()
    : [];
  const tagsByFilm = new Map<number, typeof tagRows>();
  for (const tag of tagRows) {
    const list = tagsByFilm.get(tag.filmId) ?? [];
    list.push(tag);
    tagsByFilm.set(tag.filmId, list);
  }
  return rows.map((film) => ({
    ...film,
    rcaTags: (tagsByFilm.get(film.id) ?? []).map(
      ({ id, label, attribute, polarity, color }) => ({
        id,
        label,
        attribute,
        polarity,
        color,
      }),
    ),
  }));
}

export type LibraryFilm = Awaited<ReturnType<typeof getLibraryFilms>>[number];

export async function getCatalogOptions() {
  const filmRows = db
    .select({ primary: films.genrePrimary, secondary: films.genreSecondary })
    .from(films)
    .all();
  const genreSet = new Set<string>();
  filmRows.forEach(({ primary, secondary }) => {
    if (primary) genreSet.add(primary);
    if (secondary) genreSet.add(secondary);
  });
  return {
    genres: [...genreSet].sort(),
    franchises: db
      .select({
        id: franchises.id,
        name: franchises.name,
        parentId: franchises.parentId,
      })
      .from(franchises)
      .orderBy(asc(franchises.name))
      .all(),
  };
}

export async function getFilmDetail(id: number) {
  const film = db.select().from(films).where(eq(films.id, id)).get();
  if (!film) return null;
  const rating =
    db.select().from(ratings).where(eq(ratings.filmId, id)).get() ?? null;
  const watches = db
    .select()
    .from(watchLog)
    .where(eq(watchLog.filmId, id))
    .orderBy(desc(watchLog.watchedOn), desc(watchLog.id))
    .all();
  const setting = db.select().from(settings).where(eq(settings.id, 1)).get();
  const selectedRcaTags = db
    .select({
      id: rcaTags.id,
      label: rcaTags.label,
      attribute: rcaTags.attribute,
      polarity: rcaTags.polarity,
      color: rcaTags.color,
    })
    .from(filmRcaTags)
    .innerJoin(rcaTags, eq(rcaTags.id, filmRcaTags.rcaTagId))
    .where(eq(filmRcaTags.filmId, id))
    .orderBy(asc(rcaTags.attribute), asc(rcaTags.label))
    .all();
  return {
    film,
    rating,
    watches,
    weights: (setting?.weights ?? defaultWeights) as RatingWeights,
    selectedRcaTags,
  };
}
