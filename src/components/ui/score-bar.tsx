import { formatScore, scoreOutOfFive } from "@/lib/score-format";

/** A 0–5 bar with the score beside it. Takes the stored 0–10 overall. */
export function ScoreBar({
  overall,
  className = "",
  trackClassName = "w-24 sm:w-36",
}: {
  overall: number | null;
  className?: string;
  trackClassName?: string;
}) {
  const score = scoreOutOfFive(overall);
  return (
    <span className={`flex items-center gap-2.5 ${className}`}>
      <span
        className={`bg-ink-850 h-1.5 overflow-hidden rounded-full ${trackClassName}`}
        aria-hidden="true"
      >
        <span
          className="bg-accent-400 block h-full rounded-full"
          style={{ width: `${((score ?? 0) / 5) * 100}%` }}
        />
      </span>
      <span className="text-paper-100 font-mono text-sm font-semibold tabular-nums">
        {formatScore(overall)}
      </span>
    </span>
  );
}
