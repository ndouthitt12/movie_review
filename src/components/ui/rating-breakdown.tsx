export function RatingBreakdown({
  items,
}: {
  items: Array<{ label: string; value: number; percentage?: number }>;
}) {
  const max = Math.max(1, ...items.map((item) => item.value));
  return (
    <div className="space-y-2.5">
      {items.map((item) => {
        const percentage = item.percentage ?? (item.value / max) * 100;
        return (
          <div
            key={item.label}
            className="grid grid-cols-[4rem_1fr_3rem] items-center gap-3 text-xs"
          >
            <span className="text-paper-300 truncate">{item.label}</span>
            <span className="bg-ink-800 h-2 overflow-hidden rounded-full">
              <span
                className="bg-accent-400 block h-full rounded-full"
                style={{ width: `${Math.max(0, Math.min(100, percentage))}%` }}
              />
            </span>
            <span className="text-paper-500 text-right tabular-nums">
              {Math.round(percentage)}%
            </span>
          </div>
        );
      })}
    </div>
  );
}
