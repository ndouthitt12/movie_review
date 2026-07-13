export function compareLibraryValues(
  left: string | number | null | undefined,
  right: string | number | null | undefined,
  direction: "asc" | "desc",
) {
  const leftMissing = left === null || left === undefined;
  const rightMissing = right === null || right === undefined;
  if (leftMissing && rightMissing) return 0;
  if (leftMissing) return 1;
  if (rightMissing) return -1;
  const result =
    typeof left === "number" && typeof right === "number"
      ? left - right
      : String(left).localeCompare(String(right));
  return direction === "desc" ? -result : result;
}

export function sameIdSet(
  submitted: readonly number[],
  expected: readonly number[],
) {
  if (submitted.length !== expected.length) return false;
  const values = new Set(submitted);
  return (
    values.size === submitted.length && expected.every((id) => values.has(id))
  );
}

export function validRcaFilterIds(
  value: string | null,
  availableIds: readonly number[],
) {
  if (!value) return [];
  const available = new Set(availableIds);
  return [
    ...new Set(
      value
        .split(",")
        .map(Number)
        .filter((id) => Number.isInteger(id) && id > 0 && available.has(id)),
    ),
  ];
}

export function scoreWithinRange(
  score: number | null,
  minimum: number,
  maximum: number,
  maximumExclusive = false,
) {
  if (score === null) return minimum === -Infinity && maximum === Infinity;
  return (
    score >= minimum && (maximumExclusive ? score < maximum : score <= maximum)
  );
}
