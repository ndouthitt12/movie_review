// Ratings are stored on a 0–10 scale. The site shows them out of 5 or out of
// 10, as set on the Settings page. All display code goes through these helpers.

export const scoreScales = [5, 10] as const;
export type ScoreScale = (typeof scoreScales)[number];
export const defaultScoreScale: ScoreScale = 5;

/** Reads a saved or submitted value. Anything unknown gives the default. */
export function toScoreScale(value: unknown): ScoreScale {
  return scoreScales.find((scale) => scale === value) ?? defaultScoreScale;
}

/** Converts a stored 0–10 score to the display scale. */
export function displayScore(overall: number, scale: ScoreScale): number;
export function displayScore(
  overall: number | null | undefined,
  scale: ScoreScale,
): number | null;
export function displayScore(
  overall: number | null | undefined,
  scale: ScoreScale,
) {
  if (overall === null || overall === undefined || !Number.isFinite(overall))
    return null;
  return Math.max(0, Math.min(scale, overall / (10 / scale)));
}

export function formatScore(
  overall: number | null | undefined,
  scale: ScoreScale,
  fallback = "—",
) {
  const score = displayScore(overall, scale);
  return score === null ? fallback : score.toFixed(1);
}
