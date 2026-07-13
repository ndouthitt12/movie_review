import Image from "next/image";
import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { getLibraryFilms } from "@/lib/catalog";
import { tmdbImage } from "@/lib/tmdb";

export const dynamic = "force-dynamic";

export default async function Home() {
  const films = await getLibraryFilms();
  const watched = films.filter(({ status }) => status === "watched");
  const rated = watched.filter(({ overall }) => overall !== null);
  const posters = [...films]
    .filter(({ posterPath }) => posterPath)
    .sort((a, b) => b.id - a.id)
    .slice(0, 6);
  const average = rated.length
    ? rated.reduce((sum, film) => sum + (film.overall ?? 0), 0) / rated.length
    : null;

  return (
    <PageShell>
      <section className="mx-auto max-w-4xl py-10 text-center sm:py-20">
        <p className="eyebrow">Your films. Your reasons.</p>
        <h1 className="text-paper-100 mt-4 text-5xl leading-[0.95] font-bold tracking-[-0.055em] sm:text-7xl">
          Keep a personal record of every film that moves you.
        </h1>
        <p className="text-paper-300 mx-auto mt-6 max-w-2xl text-lg leading-8">
          Build your watchlist, score what you see, and capture exactly why a
          film worked—or didn’t.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/library"
            className="bg-positive text-ink-950 rounded-ui px-6 py-3 text-sm font-bold hover:brightness-110"
          >
            Browse your films
          </Link>
          <Link
            href="/settings/rca"
            className="border-hairline bg-ink-850 text-paper-100 hover:border-paper-500 rounded-ui border px-6 py-3 text-sm font-bold"
          >
            Manage why tags
          </Link>
        </div>
      </section>

      <section aria-label="Recently added films" className="mx-auto max-w-5xl">
        {posters.length ? (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 sm:gap-3">
            {posters.map((film) => (
              <Link
                key={film.id}
                href={`/films/${film.id}`}
                className="group"
                title={`${film.title} (${film.releaseYear})`}
              >
                <div className="poster-frame relative aspect-[2/3] overflow-hidden">
                  <Image
                    src={tmdbImage(film.posterPath, "w342")!}
                    alt={`${film.title} poster`}
                    fill
                    sizes="(max-width: 640px) 33vw, 166px"
                    className="object-cover"
                  />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="panel text-paper-500 p-12 text-center text-sm">
            Add your first film to begin the poster wall.
          </div>
        )}
      </section>

      <section className="border-hairline mx-auto mt-14 grid max-w-3xl grid-cols-3 border-y py-6 text-center">
        <Stat value={films.length} label="In library" />
        <Stat value={watched.length} label="Watched" bordered />
        <Stat value={average?.toFixed(2) ?? "—"} label="Average" />
      </section>
    </PageShell>
  );
}

function Stat({
  value,
  label,
  bordered = false,
}: {
  value: string | number;
  label: string;
  bordered?: boolean;
}) {
  return (
    <div className={bordered ? "border-hairline border-x" : ""}>
      <p className="text-paper-100 text-2xl font-bold tabular-nums">{value}</p>
      <p className="text-paper-500 mt-1 text-[10px] font-semibold tracking-wider uppercase">
        {label}
      </p>
    </div>
  );
}
