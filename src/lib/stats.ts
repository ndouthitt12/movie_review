import { scoreAttributes, type ScoreAttribute } from "./scoring";

export type DashboardRating = Record<ScoreAttribute, number> & {
  overall: number;
};

export type DashboardTag = {
  id: number;
  label: string;
  attribute: ScoreAttribute | "genre_fit" | "overall";
};

export type DashboardFilm = {
  id: number;
  title: string;
  releaseYear: number;
  status: string;
  genrePrimary: string | null;
  genreSecondary: string | null;
  franchise: string | null;
  subFranchise: string | null;
  rating: DashboardRating | null;
  rcaTags: DashboardTag[];
};

export type DashboardWatch = {
  filmId: number;
  watchedOn: string;
  title?: string;
};

export const attributeLabels: Record<ScoreAttribute, string> = {
  story: "Story",
  direction: "Direction",
  writing: "Writing",
  acting: "Acting",
  music: "Music",
  impact: "Impact",
  rewatchability: "Rewatchability",
  genreFit: "Genre fit",
};

export function overallHistogram(
  values: readonly number[],
  bucketSize = 0.5,
  maximum = 10,
) {
  if (bucketSize <= 0 || maximum <= 0)
    throw new RangeError("Histogram bounds must be positive.");
  const bucketCount = Math.ceil(maximum / bucketSize);
  const counts = Array.from({ length: bucketCount }, () => 0);
  for (const value of values) {
    if (!Number.isFinite(value)) continue;
    const index = Math.min(
      bucketCount - 1,
      Math.max(0, Math.floor(value / bucketSize)),
    );
    counts[index] += 1;
  }
  const expectedWeights = counts.map((_, index) => {
    const midpoint = index * bucketSize + bucketSize / 2;
    return Math.exp(-0.5 * ((midpoint - 6.5) / 1.5) ** 2);
  });
  const expectedTotal = expectedWeights.reduce((sum, value) => sum + value, 0);
  return counts.map((count, index) => {
    const start = index * bucketSize;
    const end = Math.min(maximum, start + bucketSize);
    return {
      start,
      end,
      label: `${start.toFixed(1)}–${end.toFixed(1)}`,
      count,
      expected:
        expectedTotal === 0
          ? 0
          : (expectedWeights[index] / expectedTotal) * values.length,
    };
  });
}

export function watchesPerMonth(
  watches: readonly DashboardWatch[],
  rollingWindow = 3,
  endPeriod?: string,
) {
  if (!Number.isInteger(rollingWindow) || rollingWindow <= 0)
    throw new RangeError("Rolling window must be a positive integer.");
  const counts = new Map<string, number>();
  for (const watch of watches) {
    const period = watch.watchedOn.slice(0, 7);
    if (/^\d{4}-\d{2}$/.test(period))
      counts.set(period, (counts.get(period) ?? 0) + 1);
  }
  const periods = [...counts.keys()].sort();
  if (!periods.length) return [];
  const first = monthNumber(periods[0]);
  const requestedEnd =
    endPeriod && /^\d{4}-(0[1-9]|1[0-2])$/.test(endPeriod)
      ? monthNumber(endPeriod)
      : null;
  const last = Math.max(
    monthNumber(periods.at(-1)!),
    requestedEnd ?? -Infinity,
  );
  const series: Array<{
    period: string;
    count: number;
    rollingAverage: number;
  }> = [];
  for (let month = first; month <= last; month += 1) {
    const period = monthKey(month);
    const count = counts.get(period) ?? 0;
    const window = [
      ...series.slice(-(rollingWindow - 1)).map(({ count }) => count),
      count,
    ];
    series.push({
      period,
      count,
      rollingAverage:
        window.reduce((sum, value) => sum + value, 0) / window.length,
    });
  }
  return series;
}

export function watchesPerYear(watches: readonly DashboardWatch[]) {
  const counts = new Map<string, number>();
  for (const watch of watches) {
    const year = watch.watchedOn.slice(0, 4);
    if (/^\d{4}$/.test(year)) counts.set(year, (counts.get(year) ?? 0) + 1);
  }
  return [...counts]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([period, count]) => ({ period, count }));
}

export function attributeAverages(films: readonly DashboardFilm[]) {
  const ratings = films.flatMap(({ rating }) => (rating ? [rating] : []));
  return scoreAttributes.map((attribute) => ({
    attribute,
    label: attributeLabels[attribute],
    average: average(ratings.map((rating) => rating[attribute])),
  }));
}

export function genreBreakdown(films: readonly DashboardFilm[]) {
  const groups = new Map<string, DashboardFilm[]>();
  for (const film of ratedFilms(films)) {
    for (const genre of new Set(
      [film.genrePrimary, film.genreSecondary].filter(
        (value): value is string => Boolean(value),
      ),
    )) {
      const list = groups.get(genre) ?? [];
      list.push(film);
      groups.set(genre, list);
    }
  }
  return summarizeGroups(groups);
}

export function decadeBreakdown(films: readonly DashboardFilm[]) {
  const groups = new Map<string, DashboardFilm[]>();
  for (const film of ratedFilms(films)) {
    const decade = `${Math.floor(film.releaseYear / 10) * 10}s`;
    const list = groups.get(decade) ?? [];
    list.push(film);
    groups.set(decade, list);
  }
  return summarizeGroups(groups).sort((left, right) =>
    left.label.localeCompare(right.label),
  );
}

export function franchiseReportCards(films: readonly DashboardFilm[]) {
  const groups = new Map<string, DashboardFilm[]>();
  for (const film of ratedFilms(films)) {
    for (const name of new Set(
      [film.franchise, film.subFranchise].filter((value): value is string =>
        Boolean(value),
      ),
    )) {
      const list = groups.get(name) ?? [];
      list.push(film);
      groups.set(name, list);
    }
  }
  return summarizeGroups(groups).sort(
    (left, right) =>
      (right.average ?? -Infinity) - (left.average ?? -Infinity) ||
      right.count - left.count ||
      left.label.localeCompare(right.label),
  );
}

export function attributeOverallCorrelations(films: readonly DashboardFilm[]) {
  const ratings = films.flatMap(({ rating }) => (rating ? [rating] : []));
  return scoreAttributes
    .map((attribute) => ({
      attribute,
      label: attributeLabels[attribute],
      correlation: pearson(
        ratings.map((rating) => rating[attribute]),
        ratings.map((rating) => rating.overall),
      ),
    }))
    .sort(
      (left, right) =>
        Math.abs(right.correlation ?? 0) - Math.abs(left.correlation ?? 0),
    );
}

export function rcaTagFrequencies(films: readonly DashboardFilm[]) {
  const groups = new Map<
    number,
    {
      id: number;
      label: string;
      attribute: DashboardTag["attribute"];
      scores: number[];
    }
  >();
  for (const film of films) {
    if (!film.rating) continue;
    for (const tag of film.rcaTags) {
      const key = tag.attribute === "genre_fit" ? "genreFit" : tag.attribute;
      const score = key === "overall" ? film.rating.overall : film.rating[key];
      const group = groups.get(tag.id) ?? { ...tag, scores: [] };
      group.scores.push(score);
      groups.set(tag.id, group);
    }
  }
  return [...groups.values()]
    .map(({ scores, ...tag }) => ({
      ...tag,
      count: scores.length,
      averageScore: average(scores),
    }))
    .sort(
      (left, right) =>
        right.count - left.count || left.label.localeCompare(right.label),
    );
}

export function headlineStats(
  films: readonly DashboardFilm[],
  watches: readonly DashboardWatch[],
  today: string,
) {
  const watched = films.filter(
    ({ status }) => status === "watched" || status === "to_rewatch",
  );
  const overalls = ratedFilms(films).map(({ rating }) => rating!.overall);
  return {
    totalWatched: watched.length,
    thisMonth: watches.filter(({ watchedOn }) =>
      watchedOn.startsWith(today.slice(0, 7)),
    ).length,
    thisYear: watches.filter(({ watchedOn }) =>
      watchedOn.startsWith(today.slice(0, 4)),
    ).length,
    meanOverall: average(overalls),
  };
}

function ratedFilms(films: readonly DashboardFilm[]) {
  return films.filter(
    (film): film is DashboardFilm & { rating: DashboardRating } =>
      film.rating !== null,
  );
}

function summarizeGroups(groups: Map<string, DashboardFilm[]>) {
  return [...groups].map(([label, films]) => ({
    label,
    count: films.length,
    average: average(
      films.flatMap(({ rating }) => (rating ? [rating.overall] : [])),
    ),
  }));
}

function average(values: readonly number[]) {
  return values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : null;
}

function pearson(left: readonly number[], right: readonly number[]) {
  if (left.length !== right.length || left.length < 2) return null;
  const leftMean = average(left)!;
  const rightMean = average(right)!;
  let numerator = 0;
  let leftSquares = 0;
  let rightSquares = 0;
  for (let index = 0; index < left.length; index += 1) {
    const leftDelta = left[index] - leftMean;
    const rightDelta = right[index] - rightMean;
    numerator += leftDelta * rightDelta;
    leftSquares += leftDelta ** 2;
    rightSquares += rightDelta ** 2;
  }
  const divisor = Math.sqrt(leftSquares * rightSquares);
  return divisor === 0 ? null : numerator / divisor;
}

function monthNumber(period: string) {
  const [year, month] = period.split("-").map(Number);
  return year * 12 + month - 1;
}

function monthKey(monthNumberValue: number) {
  const year = Math.floor(monthNumberValue / 12);
  const month = (monthNumberValue % 12) + 1;
  return `${year}-${String(month).padStart(2, "0")}`;
}
