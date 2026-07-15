import { scoreAttributes, type ScoreAttribute } from "../scoring";

export type RecommendationAttribute = ScoreAttribute;

export type TasteProfileFilm = {
  tmdbId: number | null;
  status: "watched" | "to_watch" | "to_rewatch";
  overall: number | null;
  releaseYear: number;
  lastWatchDate: string | null;
  genrePrimary: string | null;
  genreSecondary: string | null;
  tmdbGenres: string[] | null;
  director: string | null;
  franchiseId?: number | null;
  story?: number | null;
  direction?: number | null;
  writing?: number | null;
  acting?: number | null;
  music?: number | null;
  impact?: number | null;
  rewatchability?: number | null;
  genreFit?: number | null;
  rcaTags: Array<{
    label: string;
    polarity: "positive" | "negative" | "neutral";
  }>;
};

export interface TasteProfile {
  genreAffinity: Record<string, number>;
  directorAffinity: Record<string, number>;
  attributeWeights: Record<RecommendationAttribute, number>;
  positiveTagThemes: Record<string, number>;
  negativeTagThemes: Record<string, number>;
  meanScore: number;
  ratedTmdbIds: Set<number>;
  watchlistTmdbIds: Set<number>;
  eraAffinity: Record<string, number>;
  franchiseIds: Set<number>;
  sampleSize: number;
}

export type TasteProfileOptions = {
  now?: Date;
  genreShrinkage?: number;
  directorShrinkage?: number;
  eraShrinkage?: number;
};

type AffinityAccumulator = {
  weightedSignal: number;
  totalWeight: number;
};

const UNIFORM_ATTRIBUTE_WEIGHT = 1 / scoreAttributes.length;

export function neutralTasteProfile(): TasteProfile {
  return {
    genreAffinity: {},
    directorAffinity: {},
    attributeWeights: Object.fromEntries(
      scoreAttributes.map((attribute) => [
        attribute,
        UNIFORM_ATTRIBUTE_WEIGHT,
      ]),
    ) as Record<RecommendationAttribute, number>,
    positiveTagThemes: {},
    negativeTagThemes: {},
    meanScore: 0,
    ratedTmdbIds: new Set(),
    watchlistTmdbIds: new Set(),
    eraAffinity: {},
    franchiseIds: new Set(),
    sampleSize: 0,
  };
}

/** Taste decay specified by the plan: e^(-age in days / 730). */
export function recencyWeight(lastWatchDate: string | null, now: Date) {
  if (!lastWatchDate) return 1;
  const watchedAt = new Date(`${lastWatchDate}T00:00:00Z`).getTime();
  if (!Number.isFinite(watchedAt)) return 1;
  const ageInDays = Math.max(0, (now.getTime() - watchedAt) / 86_400_000);
  return Math.exp(-ageInDays / 730);
}

export function isNeutralTasteProfile(profile: TasteProfile) {
  const affinityValues = [
    ...Object.values(profile.genreAffinity),
    ...Object.values(profile.directorAffinity),
    ...Object.values(profile.eraAffinity),
    ...Object.values(profile.positiveTagThemes),
    ...Object.values(profile.negativeTagThemes),
  ];
  return (
    profile.sampleSize === 0 ||
    affinityValues.every((value) => Math.abs(value) < 1e-9)
  );
}

export function buildTasteProfile(
  films: readonly TasteProfileFilm[],
  options: TasteProfileOptions = {},
): TasteProfile {
  const rated = films.filter(
    (film): film is TasteProfileFilm & { overall: number } =>
      film.overall !== null && Number.isFinite(film.overall),
  );
  const profile = neutralTasteProfile();
  profile.sampleSize = rated.length;
  profile.watchlistTmdbIds = new Set(
    films
      .filter(({ status, tmdbId }) => status === "to_watch" && tmdbId !== null)
      .map(({ tmdbId }) => tmdbId as number),
  );
  profile.ratedTmdbIds = new Set(
    rated
      .filter(({ tmdbId }) => tmdbId !== null)
      .map(({ tmdbId }) => tmdbId as number),
  );
  if (rated.length === 0) return profile;

  const now = options.now ?? new Date();
  const meanScore =
    rated.reduce((sum, { overall }) => sum + overall, 0) / rated.length;
  profile.meanScore = meanScore;
  const maximumDeviation = Math.max(
    1,
    ...rated.map(({ overall }) => Math.abs(overall - meanScore)),
  );
  const genre = new Map<string, AffinityAccumulator>();
  const directors = new Map<string, AffinityAccumulator>();
  const eras = new Map<string, AffinityAccumulator>();
  const positiveTags = new Map<string, number>();
  const negativeTags = new Map<string, number>();

  for (const film of rated) {
    const signal = clamp((film.overall - meanScore) / maximumDeviation, -1, 1);
    const recency = recencyWeight(film.lastWatchDate, now);
    for (const [name, sourceWeight] of genreWeights(film))
      accumulate(genre, name, signal, recency * sourceWeight);
    if (film.director?.trim())
      accumulate(directors, film.director.trim(), signal, recency);
    accumulate(eras, decade(film.releaseYear), signal, recency);

    if (signal > 0 && film.franchiseId != null)
      profile.franchiseIds.add(film.franchiseId);
    for (const tag of film.rcaTags) {
      if (tag.polarity === "positive" && signal > 0)
        positiveTags.set(
          tag.label,
          (positiveTags.get(tag.label) ?? 0) + signal * recency,
        );
      if (tag.polarity === "negative" && signal < 0)
        negativeTags.set(
          tag.label,
          (negativeTags.get(tag.label) ?? 0) + -signal * recency,
        );
    }
  }

  profile.genreAffinity = finishAffinities(
    genre,
    options.genreShrinkage ?? 3,
  );
  profile.directorAffinity = finishAffinities(
    directors,
    options.directorShrinkage ?? 1.5,
  );
  profile.eraAffinity = finishAffinities(
    eras,
    options.eraShrinkage ?? 3,
  );
  profile.attributeWeights = attributeWeights(rated, now);
  profile.positiveTagThemes = topThemes(positiveTags);
  profile.negativeTagThemes = topThemes(negativeTags);
  return profile;
}

function genreWeights(film: TasteProfileFilm) {
  const weights = new Map<string, number>();
  const add = (name: string | null | undefined, weight: number) => {
    const value = name?.trim();
    if (value) weights.set(value, Math.max(weights.get(value) ?? 0, weight));
  };
  add(film.genrePrimary, 1);
  add(film.genreSecondary, 0.6);
  for (const genre of film.tmdbGenres ?? []) add(genre, 0.4);
  return weights;
}

function accumulate(
  target: Map<string, AffinityAccumulator>,
  key: string,
  signal: number,
  weight: number,
) {
  const value = target.get(key) ?? { weightedSignal: 0, totalWeight: 0 };
  value.weightedSignal += signal * weight;
  value.totalWeight += weight;
  target.set(key, value);
}

function finishAffinities(
  values: Map<string, AffinityAccumulator>,
  shrinkage: number,
) {
  return Object.fromEntries(
    [...values]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, { weightedSignal, totalWeight }]) => {
        const mean = totalWeight ? weightedSignal / totalWeight : 0;
        const shrunk = mean * (totalWeight / (totalWeight + shrinkage));
        return [key, clamp(shrunk, -1, 1)];
      }),
  );
}

function attributeWeights(
  films: readonly (TasteProfileFilm & { overall: number })[],
  now: Date,
) {
  if (films.length < 8)
    return Object.fromEntries(
      scoreAttributes.map((attribute) => [
        attribute,
        UNIFORM_ATTRIBUTE_WEIGHT,
      ]),
    ) as Record<RecommendationAttribute, number>;

  const correlations = Object.fromEntries(
    scoreAttributes.map((attribute) => {
      const pairs = films
        .filter(
          (film) =>
            typeof film[attribute] === "number" &&
            Number.isFinite(film[attribute]),
        )
        .map((film) => ({
          x: film[attribute] as number,
          y: film.overall,
          weight: recencyWeight(film.lastWatchDate, now),
        }));
      return [attribute, Math.abs(weightedPearson(pairs))];
    }),
  ) as Record<RecommendationAttribute, number>;
  const total = Object.values(correlations).reduce(
    (sum, value) => sum + value,
    0,
  );
  if (total < 1e-9)
    return Object.fromEntries(
      scoreAttributes.map((attribute) => [
        attribute,
        UNIFORM_ATTRIBUTE_WEIGHT,
      ]),
    ) as Record<RecommendationAttribute, number>;
  return Object.fromEntries(
    scoreAttributes.map((attribute) => [
      attribute,
      correlations[attribute] / total,
    ]),
  ) as Record<RecommendationAttribute, number>;
}

function weightedPearson(
  pairs: readonly { x: number; y: number; weight: number }[],
) {
  if (pairs.length < 3) return 0;
  const totalWeight = pairs.reduce((sum, { weight }) => sum + weight, 0);
  if (!totalWeight) return 0;
  const meanX =
    pairs.reduce((sum, { x, weight }) => sum + x * weight, 0) / totalWeight;
  const meanY =
    pairs.reduce((sum, { y, weight }) => sum + y * weight, 0) / totalWeight;
  let covariance = 0;
  let varianceX = 0;
  let varianceY = 0;
  for (const { x, y, weight } of pairs) {
    const centeredX = x - meanX;
    const centeredY = y - meanY;
    covariance += weight * centeredX * centeredY;
    varianceX += weight * centeredX * centeredX;
    varianceY += weight * centeredY * centeredY;
  }
  const denominator = Math.sqrt(varianceX * varianceY);
  return denominator < 1e-12 ? 0 : covariance / denominator;
}

function topThemes(values: Map<string, number>) {
  return Object.fromEntries(
    [...values]
      .sort(
        ([leftLabel, leftWeight], [rightLabel, rightWeight]) =>
          rightWeight - leftWeight || leftLabel.localeCompare(rightLabel),
      )
      .slice(0, 20),
  );
}

function decade(year: number) {
  return `${Math.floor(year / 10) * 10}s`;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}
