/** 127 → "2h 07m", 45 → "45m", null → fallback. */
export function formatRuntime(runtime: number | null, fallback = "—") {
  if (!runtime) return fallback;
  const hours = Math.floor(runtime / 60);
  const minutes = runtime % 60;
  return hours
    ? `${hours}h ${String(minutes).padStart(2, "0")}m`
    : `${minutes}m`;
}
