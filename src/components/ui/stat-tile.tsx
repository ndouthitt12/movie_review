import type { ReactNode } from "react";

export function StatTile({
  icon,
  value,
  label,
  delta,
  className = "",
}: {
  icon: ReactNode;
  value: ReactNode;
  label: string;
  delta?: string;
  className?: string;
}) {
  return (
    <article
      className={`border-hairline bg-ink-850 rounded-ui border p-4 ${className}`}
    >
      <div className="text-accent-400 mb-4 h-6 w-6">{icon}</div>
      <p className="text-paper-100 text-2xl font-medium tabular-nums">
        {value}
      </p>
      <p className="text-paper-300 mt-1 text-sm">{label}</p>
      {delta ? <p className="text-positive mt-1.5 text-xs">↑ {delta}</p> : null}
    </article>
  );
}
