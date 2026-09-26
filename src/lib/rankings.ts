import { rankFilms } from "./scoring";
import { scoreOutOfFive } from "./score-format";

type RankingInput = {
  id: number;
  title: string;
  status: string;
  overall: number | null;
  franchise: string | null;
  lastWatchDate: string | null;
  watchOrder: number | null;
};

/** Rated films with competition ranks (1, 2, 2, 4), best first. */
export function rankedFilms<T extends RankingInput>(films: readonly T[]) {
  const rated = films.filter(
    (film): film is T & { overall: number } => film.overall !== null,
  );
  return rankFilms(rated).sort(
    (left, right) =>
      left.rank - right.rank || left.title.localeCompare(right.title),
  );
}

/**
 * Counts films in half-point bins of the displayed 0–5 score. Bins start at
 * the lowest occupied bin, so the chart does not waste room on empty lows.
 * A film goes in the bin of its rounded, displayed score.
 */
export function scoreSpread(overalls: readonly number[]) {
  const shown = overalls.map(
    (overall) => Math.round(scoreOutOfFive(overall) * 10) / 10,
  );
  if (!shown.length) return [];
  const binOf = (score: number) => Math.min(9, Math.floor(score * 2));
  const first = Math.min(...shown.map(binOf));
  const bins = Array.from({ length: 10 - first }, (_, index) => {
    const start = (first + index) / 2;
    const last = first + index === 9;
    return {
      start,
      label: `${start.toFixed(1)}–${(last ? 5 : start + 0.4).toFixed(1)}`,
      count: 0,
    };
  });
  for (const score of shown) bins[binOf(score) - first].count += 1;
  return bins;
}

/** Average score per franchise, best first. Films without one are skipped. */
export function franchiseAverages(films: readonly RankingInput[]) {
  const groups = new Map<string, number[]>();
  for (const film of films) {
    if (film.overall === null || !film.franchise) continue;
    groups.set(film.franchise, [
      ...(groups.get(film.franchise) ?? []),
      film.overall,
    ]);
  }
  return [...groups]
    .map(([name, overalls]) => ({
      name,
      count: overalls.length,
      average:
        overalls.reduce((sum, value) => sum + value, 0) / overalls.length,
    }))
    .sort(
      (left, right) =>
        right.average - left.average || left.name.localeCompare(right.name),
    );
}

/** The film with the latest watch date, or null when nothing has a date. */
export function lastWatchedFilm<T extends RankingInput>(films: readonly T[]) {
  return (
    films
      .filter((film) => film.lastWatchDate)
      .sort(
        (left, right) =>
          right.lastWatchDate!.localeCompare(left.lastWatchDate!) ||
          right.id - left.id,
      )[0] ?? null
  );
}

/** Watchlist films in their saved order, then films marked for a rewatch. */
export function upNextFilms<T extends RankingInput>(films: readonly T[]) {
  const toWatch = films
    .filter(({ status }) => status === "to_watch")
    .sort(
      (left, right) =>
        (left.watchOrder ?? Infinity) - (right.watchOrder ?? Infinity) ||
        left.title.localeCompare(right.title),
    );
  const toRewatch = films
    .filter(({ status }) => status === "to_rewatch")
    .sort((left, right) => left.title.localeCompare(right.title));
  return [...toWatch, ...toRewatch];
}
