export function RouteContentLoading({
  label = "Loading page content",
}: {
  label?: string;
}) {
  return (
    <div
      className="animate-pulse space-y-6 py-8 sm:py-10"
      role="status"
      aria-label={label}
    >
      <div className="bg-ink-800 h-8 w-48 rounded" />
      <div className="bg-ink-850 h-4 w-72 max-w-full rounded" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="bg-ink-850 aspect-[2/3] rounded-lg" />
        ))}
      </div>
    </div>
  );
}
