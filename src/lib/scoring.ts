export const scoreAttributes = [
  "story",
  "direction",
  "writing",
  "acting",
  "music",
  "impact",
  "rewatchability",
  "genreFit",
] as const;

export type ScoreAttribute = (typeof scoreAttributes)[number];
export type AttributeScores = Record<ScoreAttribute, number>;

export type RatingWeights = Record<ScoreAttribute, number> & {
  rewatchabilityOffset: number;
  divisor: number;
};

function assertFinite(values: Record<string, number>) {
  for (const [name, value] of Object.entries(values)) {
    if (!Number.isFinite(value))
      throw new TypeError(`${name} must be a finite number`);
  }
}

export function computeOverall(
  scores: AttributeScores,
  weights: RatingWeights,
): number {
  assertFinite(scores);
  assertFinite(weights);
  if (weights.divisor <= 0)
    throw new RangeError("divisor must be greater than zero");

  const numerator =
    scores.story * weights.story +
    scores.direction * weights.direction +
    scores.writing * weights.writing +
    scores.acting * weights.acting +
    scores.music * weights.music +
    scores.impact * weights.impact +
    (scores.rewatchability + weights.rewatchabilityOffset) *
      weights.rewatchability +
    scores.genreFit * weights.genreFit;

  return Math.max(0, numerator / weights.divisor);
}

export function computeSecondary(
  quality: number,
  rewatchability: number,
  genreFit: number,
): number {
  assertFinite({ quality, rewatchability, genreFit });
  return (quality * 5 + rewatchability * 4 + genreFit) / 100;
}

export type Rankable = { overall: number };
export type Ranked<T> = T & { rank: number };

/** Spreadsheet RANK semantics: descending competition ranking (1, 2, 2, 4). */
export function rankFilms<T extends Rankable>(
  films: readonly T[],
): Array<Ranked<T>> {
  const sortedScores = films
    .map(({ overall }) => overall)
    .sort((a, b) => b - a);
  return films.map((film) => ({
    ...film,
    rank: sortedScores.indexOf(film.overall) + 1,
  }));
}
