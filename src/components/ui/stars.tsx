export function Stars({
  value,
  outOf = 5,
  className = "",
}: {
  value: number;
  outOf?: number;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(outOf, value));
  return (
    <span
      className={`inline-flex gap-0.5 ${className}`}
      role="img"
      aria-label={`${clamped.toFixed(1)} out of ${outOf} stars`}
    >
      {Array.from({ length: outOf }, (_, index) => {
        const fill = Math.max(0, Math.min(1, clamped - index)) * 100;
        return (
          <span key={index} className="relative inline-block leading-none">
            <span className="text-ink-800">★</span>
            <span
              className="text-accent-400 absolute inset-0 overflow-hidden"
              style={{ width: `${fill}%` }}
              aria-hidden="true"
            >
              ★
            </span>
          </span>
        );
      })}
    </span>
  );
}
