export default function Loading() {
  return (
    <div className="min-h-screen pb-20 md:pb-0">
      <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
        <div
          className="animate-pulse space-y-6"
          role="status"
          aria-label="Loading admin page"
        >
          <div className="bg-ink-800 h-8 w-48 rounded" />
          <div className="bg-ink-850 h-4 w-72 max-w-full rounded" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="bg-ink-850 aspect-[2/3] rounded-lg" />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
