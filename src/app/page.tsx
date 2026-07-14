import Image from "next/image";
import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { Pill } from "@/components/ui/pill";
import { RatingBreakdown } from "@/components/ui/rating-breakdown";
import { SectionCard } from "@/components/ui/section-card";
import { Stars } from "@/components/ui/stars";
import { getLibraryFilms, type LibraryFilm } from "@/lib/catalog";
import { tmdbImage } from "@/lib/tmdb";

export const dynamic = "force-dynamic";

const attributeLabels: Array<{
  key: keyof Pick<
    LibraryFilm,
    | "story"
    | "direction"
    | "writing"
    | "acting"
    | "music"
    | "impact"
    | "rewatchability"
    | "genreFit"
  >;
  label: string;
}> = [
  { key: "story", label: "Story" },
  { key: "direction", label: "Direction" },
  { key: "writing", label: "Writing" },
  { key: "acting", label: "Acting" },
  { key: "music", label: "Music" },
  { key: "impact", label: "Impact" },
  { key: "rewatchability", label: "Rewatch" },
  { key: "genreFit", label: "Genre fit" },
];

export default async function Home() {
  const films = await getLibraryFilms();
  const watched = films.filter(
    ({ status }) => status === "watched" || status === "to_rewatch",
  );
  const rated = watched.filter(({ overall }) => overall !== null);
  const featured = mostRecent(rated)[0] ?? mostRecent(watched)[0] ?? films[0];
  const recentRatings = mostRecent(rated).slice(0, 3);
  const posters = [...films]
    .filter(({ posterPath }) => posterPath)
    .sort((a, b) => b.id - a.id)
    .slice(0, 12);
  const genres = topGenres(films, 6);
  const breakdown = featured
    ? attributeLabels.flatMap(({ key, label }) => {
        const value = featured[key];
        return value === null ? [] : [{ label, value, percentage: value }];
      })
    : [];

  return (
    <PageShell>
      {featured ? (
        <>
          <section className="panel grid gap-6 p-5 sm:p-7 md:grid-cols-[15rem_minmax(0,1fr)] md:gap-8 lg:grid-cols-[18rem_minmax(0,1fr)]">
            <Link
              href={`/films/${featured.id}`}
              className="group mx-auto w-full max-w-72 md:max-w-none"
            >
              <div className="poster-frame relative aspect-[2/3] overflow-hidden">
                {featured.posterPath ? (
                  <Image
                    src={tmdbImage(featured.posterPath, "w500")!}
                    alt={`${featured.title} poster`}
                    fill
                    priority
                    sizes="(max-width: 768px) 288px, 288px"
                    className="object-cover"
                  />
                ) : (
                  <div className="text-paper-500 flex h-full items-center justify-center p-6 text-center font-serif">
                    {featured.title}
                  </div>
                )}
              </div>
            </Link>

            <div className="flex min-w-0 flex-col justify-center py-1">
              <p className="text-accent-400 text-xs font-semibold tracking-[0.16em] uppercase">
                Featured
              </p>
              <Link href={`/films/${featured.id}`} className="mt-3 block">
                <h1 className="text-paper-100 hover:text-accent-400 font-serif text-4xl leading-none tracking-[-0.035em] transition-colors sm:text-5xl lg:text-6xl">
                  {featured.title}
                </h1>
              </Link>
              <p className="text-paper-300 mt-4 text-sm sm:text-base">
                {[
                  featured.genrePrimary,
                  featured.genreSecondary,
                  featured.releaseYear,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>

              {featured.overall !== null ? (
                <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2">
                  <span
                    className="text-accent-400 text-5xl leading-none"
                    aria-hidden="true"
                  >
                    ★
                  </span>
                  <span className="text-paper-100 text-4xl font-semibold tabular-nums sm:text-5xl">
                    {(featured.overall / 2).toFixed(1)}
                  </span>
                  <span className="text-paper-300 text-lg">/ 5</span>
                  <span className="text-paper-500 text-sm">1 rating</span>
                </div>
              ) : null}

              {featured.notes ? (
                <blockquote className="border-hairline text-paper-300 mt-7 border-t pt-5 text-base leading-7 sm:text-lg">
                  <p>{featured.notes}</p>
                  <footer className="text-paper-500 mt-3 text-sm italic">
                    — Your notes
                  </footer>
                </blockquote>
              ) : null}
            </div>
          </section>

          {featured.overall !== null ? (
            <SectionCard title="Rating summary" className="mt-5">
              <div className="grid gap-7 md:grid-cols-[17rem_1fr] md:items-center">
                <div className="border-hairline md:border-r md:pr-8">
                  <p className="text-accent-400 font-serif text-7xl leading-none tabular-nums">
                    {(featured.overall / 2).toFixed(1)}
                  </p>
                  <Stars
                    value={featured.overall / 2}
                    className="mt-3 text-2xl"
                  />
                  <p className="text-paper-500 mt-2 text-sm">
                    Based on 1 rating
                  </p>
                </div>
                {breakdown.length ? (
                  <RatingBreakdown items={breakdown} />
                ) : (
                  <p className="text-paper-500 text-sm">
                    Attribute scores will appear after this film is rated with
                    the active form.
                  </p>
                )}
              </div>
            </SectionCard>
          ) : null}
        </>
      ) : (
        <section className="panel px-6 py-16 text-center sm:px-10">
          <p className="eyebrow">Your films. Your reasons.</p>
          <h1 className="text-paper-100 mx-auto mt-4 max-w-3xl font-serif text-4xl leading-tight sm:text-6xl">
            Your Picture House is ready for its first film.
          </h1>
          <Link
            href="/library"
            className="bg-accent-400 text-ink-950 hover:bg-accent-500 mt-8 inline-flex min-h-10 items-center rounded-full px-5 text-sm font-semibold transition-colors"
          >
            Open the library
          </Link>
        </section>
      )}

      {genres.length ? (
        <nav
          aria-label="Browse by genre"
          className="mt-6 flex gap-2 overflow-x-auto pb-1"
        >
          <Pill active href="/library">
            All
          </Pill>
          {genres.map((genre) => (
            <Pill
              key={genre}
              href={`/library?genre=${encodeURIComponent(genre)}`}
            >
              {genre}
            </Pill>
          ))}
        </nav>
      ) : null}

      {recentRatings.length ? (
        <section className="mt-10">
          <SectionHeading title="Recent ratings" href="/library" />
          <div className="grid gap-3 md:grid-cols-3">
            {recentRatings.map((film) => (
              <Link
                key={film.id}
                href={`/films/${film.id}`}
                className="panel hover:border-accent-400 flex min-h-52 flex-col p-5 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <span className="bg-ink-850 text-accent-400 flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-serif text-lg">
                    Y
                  </span>
                  <div className="min-w-0">
                    <p className="text-paper-100 truncate font-medium">
                      Your rating
                    </p>
                    <p className="text-paper-500 truncate text-xs">
                      {film.title}
                    </p>
                    <Stars
                      value={(film.overall ?? 0) / 2}
                      className="mt-1 text-sm"
                    />
                  </div>
                </div>
                <p className="text-paper-300 mt-4 line-clamp-4 text-sm leading-6">
                  {film.notes || "No notes added."}
                </p>
                <p className="text-paper-500 mt-auto pt-4 text-xs">
                  {relativeWatchDate(film.lastWatchDate)}
                </p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {posters.length ? (
        <section className="mt-10">
          <SectionHeading title="Recently added" href="/library" />
          <div className="flex snap-x gap-3 overflow-x-auto pb-3">
            {posters.map((film) => (
              <Link
                key={film.id}
                href={`/films/${film.id}`}
                className="group w-36 shrink-0 snap-start sm:w-44"
              >
                <div className="poster-frame relative aspect-[2/3] overflow-hidden">
                  <Image
                    src={tmdbImage(film.posterPath, "w342")!}
                    alt={`${film.title} poster`}
                    fill
                    sizes="(max-width: 640px) 144px, 176px"
                    className="object-cover"
                  />
                </div>
                <p className="text-paper-300 group-hover:text-accent-400 mt-2 truncate text-sm transition-colors">
                  {film.title}
                </p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </PageShell>
  );
}

function SectionHeading({ title, href }: { title: string; href: string }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-4">
      <h2 className="text-paper-100 text-sm font-semibold tracking-[0.08em] uppercase sm:text-base">
        {title}
      </h2>
      <Link
        href={href}
        className="text-accent-400 hover:text-paper-100 text-sm transition-colors"
      >
        See all <span aria-hidden="true">›</span>
      </Link>
    </div>
  );
}

function mostRecent(films: LibraryFilm[]) {
  return [...films].sort(
    (a, b) =>
      (b.lastWatchDate ?? "").localeCompare(a.lastWatchDate ?? "") ||
      b.id - a.id,
  );
}

function topGenres(films: LibraryFilm[], limit: number) {
  const counts = new Map<string, number>();
  for (const film of films) {
    for (const genre of new Set(
      [film.genrePrimary, film.genreSecondary].filter(
        (value): value is string => Boolean(value),
      ),
    )) {
      counts.set(genre, (counts.get(genre) ?? 0) + 1);
    }
  }
  return [...counts]
    .sort(([leftGenre, leftCount], [rightGenre, rightCount]) =>
      rightCount === leftCount
        ? leftGenre.localeCompare(rightGenre)
        : rightCount - leftCount,
    )
    .slice(0, limit)
    .map(([genre]) => genre);
}

function relativeWatchDate(date: string | null) {
  if (!date) return "Watch date not logged";
  const watched = new Date(`${date}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.max(
    0,
    Math.floor((today.getTime() - watched.getTime()) / 86_400_000),
  );
  if (days === 0) return "Today";
  if (days === 1) return "1d ago";
  return `${days}d ago`;
}
