// Ratings are stored on a 0–10 scale. Every page shows them out of 5 with one
// decimal, so all display code goes through these two helpers.

export function scoreOutOfFive(overall: number): number;
export function scoreOutOfFive(
  overall: number | null | undefined,
): number | null;
export function scoreOutOfFive(overall: number | null | undefined) {
  if (overall === null || overall === undefined || !Number.isFinite(overall))
    return null;
  return Math.max(0, Math.min(5, overall / 2));
}

export function formatScore(
  overall: number | null | undefined,
  fallback = "—",
) {
  const score = scoreOutOfFive(overall);
  return score === null ? fallback : score.toFixed(1);
}
