import type { RcaTagWithUsage } from "@/lib/rca";

type ChipTag = Pick<RcaTagWithUsage, "id" | "label" | "polarity" | "color">;

export function RcaChip({
  tag,
  onRemove,
  compact = false,
}: {
  tag: ChipTag;
  onRemove?: (id: number) => void;
  compact?: boolean;
}) {
  const tone =
    tag.polarity === "positive"
      ? "border-positive/35 bg-positive/10 text-positive"
      : tag.polarity === "negative"
        ? "border-accent-400/35 bg-accent-400/10 text-accent-300"
        : "border-sky/30 bg-sky/10 text-sky";
  return (
    <span
      className={`rounded-ui inline-flex max-w-full items-center gap-1.5 border font-medium ${tone} ${compact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-xs"}`}
      style={
        tag.color ? { borderColor: tag.color, color: tag.color } : undefined
      }
    >
      <span className="truncate">{tag.label}</span>
      {onRemove ? (
        <button
          type="button"
          onClick={() => onRemove(tag.id)}
          aria-label={`Remove ${tag.label}`}
          className="-mr-0.5 leading-none opacity-70 hover:opacity-100"
        >
          ×
        </button>
      ) : null}
    </span>
  );
}
