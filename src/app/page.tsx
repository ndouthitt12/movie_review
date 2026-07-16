import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { PageShell } from "@/components/page-shell";
import { RouteContentLoading } from "@/components/route-content-loading";
import { HeroCarousel, type HeroFilm } from "@/components/home/hero-carousel";
import { PosterRail, type HomePoster } from "@/components/home/poster-rail";
import { ChevronRightIcon, ClockIcon, PlusIcon } from "@/components/ui/icons";
import { Stars } from "@/components/ui/stars";
import { getLibraryFilms, type LibraryFilm } from "@/lib/catalog";
import { getRecommendations, getTrending } from "@/lib/recs-server";
import { selectTmdbTrailer, tmdbImage } from "@/lib/tmdb";
import { getTmdbVideos } from "@/lib/tmdb-server";
import styles from "./home.module.css";

export const unstable_instant = { prefetch: "static" };

const genreFallback = [
  "Action",
  "Adventure",
  "Animation",
  "Comedy",
  "Crime",
  "Documentary",
  "Drama",
  "Horror",
  "Sci-Fi",
  "Thriller",
];

export default function Home() {
  return (
    <PageShell>
      <Suspense fallback={<RouteContentLoading label="Loading home" />}>
        <HomeContent />
      </Suspense>
    </PageShell>
  );
}

async function HomeContent() {
  await connection();
  const [films, recommendations, trending] = await Promise.all([
    getLibraryFilms(),
    getRecommendations(8).catch(() => null),
    getTrending(16).catch(() => null),
  ]);
  const watched = films.filter(
    ({ status }) => status === "watched" || status === "to_rewatch",
  );
  const rated = mostRecent(watched.filter(({ overall }) => overall !== null));
  const featuredFilms = uniqueFilms([
    ...rated,
    ...mostRecent(watched),
    ...films,
  ]).slice(0, 4);
  const featured = featuredFilms[0];
  const heroFilms: HeroFilm[] = await Promise.all(
    featuredFilms.map(async (film) => {
      const trailer = film.tmdbId
        ? await getTmdbVideos(film.tmdbId)
            .then(selectTmdbTrailer)
            .catch(() => null)
        : null;
      return {
        id: film.id,
        title: film.title,
        releaseYear: film.releaseYear,
        status: film.status,
        genres: uniqueGenres(film).map(normalizeGenre),
        runtime: film.runtime,
        overview:
          film.overview?.trim() ||
          film.notes.trim() ||
          "A standout selection from your personal film library, ready to revisit and rate.",
        backdropPath: film.backdropPath,
        score: scoreOutOfFive(film.overall),
        trailerKey: trailer?.key ?? null,
      };
    }),
  );
  const recentRatings = rated.slice(0, 3);
  const recentNotes = rated.filter(({ notes }) => notes.trim()).slice(0, 4);
  const libraryPosters = [...films]
    .filter(({ id, posterPath }) => posterPath && id !== featured?.id)
    .sort(
      (a, b) =>
        (b.lastWatchDate ?? "").localeCompare(a.lastWatchDate ?? "") ||
        b.id - a.id,
    )
    .slice(0, 8);
  const trendingPosters: HomePoster[] =
    trending?.available && trending.items.length
      ? trending.items.slice(0, 8).map((item) => ({
          key: `tmdb-${item.tmdbId}`,
          tmdbId: item.tmdbId,
          libraryFilmId: item.libraryFilmId,
          title: item.title,
          year: item.year,
          posterPath: item.posterPath,
          rating: item.rating,
          badge: item.badge,
        }))
      : libraryPosters.map(libraryPoster);
  const recommendedPosters: HomePoster[] =
    recommendations?.available && recommendations.items.length
      ? recommendations.items.map((item) => ({
          key: `recommendation-${item.tmdbId}`,
          tmdbId: item.tmdbId,
          libraryFilmId: item.libraryFilmId,
          title: item.title,
          year: item.year,
          posterPath: item.posterPath!,
          rating: Math.max(0, Math.min(5, item.voteAverage / 2)),
          reason: item.reasons[0],
          badge: item.isWatchlist ? "From your watchlist" : undefined,
        }))
      : [];
  const rankedGenres = topGenres(films, 10);
  const canonicalMatches = genreFallback.filter((genre) =>
    rankedGenres.map(normalizeGenre).includes(genre),
  );
  const genres =
    canonicalMatches.length >= 8 ? canonicalMatches : genreFallback;

  return (
    <div className={styles.homeGrid}>
      <div className={styles.mainColumn}>
        {heroFilms.length ? <HeroCarousel films={heroFilms} /> : <EmptyHero />}

        <section className={styles.trendingSection}>
          <SectionHeading title="Trending Now" href="/trending" />
          <PosterRail items={trendingPosters} />
        </section>

        {recommendedPosters.length ? (
          <section className={styles.recommendedSection}>
            <SectionHeading
              title={
                recommendations?.mode === "trending"
                  ? "Popular Right Now"
                  : "Recommended For You"
              }
              href="/recommendations"
            />
            <PosterRail items={recommendedPosters} showMeta />
          </section>
        ) : null}

        <section className={styles.reviewsSection}>
          <SectionHeading
            title="Your Recent Notes"
            href="/library?status=rated&sort=lastWatchDate&dir=desc"
          />
          {recentNotes.length ? (
            <div className={styles.reviewGrid}>
              {recentNotes.map((film, index) => (
                <Link
                  href={`/films/${film.id}`}
                  className={styles.reviewCard}
                  key={film.id}
                >
                  <article>
                    <div className={styles.reviewHeader}>
                      <Avatar
                        initials={titleInitials(film.title)}
                        index={index}
                      />
                      <div className={styles.reviewIdentity}>
                        <span>{film.title}</span>
                        <Stars
                          value={scoreOutOfFive(film.overall)}
                          className={styles.reviewStars}
                        />
                      </div>
                      <time>{relativeWatchDate(film.lastWatchDate)}</time>
                    </div>
                    <p className={styles.reviewText}>{film.notes.trim()}</p>
                  </article>
                </Link>
              ))}
            </div>
          ) : (
            <Link href="/library" className={styles.reviewEmpty}>
              Add notes when you rate films and your latest reflections will
              appear here.
            </Link>
          )}
        </section>
      </div>

      <aside className={styles.sidebar} aria-label="Discover more">
        <TopRated films={rated} />
        <Genres genres={genres} />
        <RecentlyReviewed films={recentRatings} />
      </aside>
    </div>
  );
}

function EmptyHero() {
  return (
    <section className={`${styles.hero} ${styles.emptyHero}`}>
      <div className={styles.heroContent}>
        <p className={styles.featuredLabel}>Featured</p>
        <h1>Your next great watch starts here.</h1>
        <p className={styles.synopsis}>
          Add films to your library to turn this page into your personal
          discovery feed.
        </p>
        <Link href="/library" className={styles.primaryAction}>
          <PlusIcon />
          Open the library
        </Link>
      </div>
    </section>
  );
}

function libraryPoster(film: LibraryFilm): HomePoster {
  return {
    key: `library-${film.id}`,
    tmdbId: film.tmdbId,
    libraryFilmId: film.id,
    title: film.title,
    year: film.releaseYear,
    posterPath: film.posterPath!,
    rating: scoreOutOfFive(film.overall),
  };
}

function TopRated({ films }: { films: LibraryFilm[] }) {
  const top = [...films]
    .sort(
      (left, right) =>
        (right.overall ?? 0) - (left.overall ?? 0) ||
        left.title.localeCompare(right.title),
    )
    .slice(0, 5);
  return (
    <section className={`${styles.sidePanel} ${styles.criticsPanel}`}>
      <PanelHeading
        title="Top Rated"
        href="/library?status=rated&sort=overall&dir=desc"
      />
      <div className={styles.criticList}>
        {top.length ? (
          top.map((film, index) => (
            <Link
              href={`/films/${film.id}`}
              className={styles.criticRow}
              key={film.id}
            >
              <FilmThumb film={film} index={index} />
              <span className={styles.criticName}>{film.title}</span>
              <span className={styles.criticScore}>
                {scoreOutOfFive(film.overall).toFixed(1)}
              </span>
            </Link>
          ))
        ) : (
          <p className={styles.recentEmpty}>Rated films will appear here.</p>
        )}
      </div>
    </section>
  );
}

function Genres({ genres }: { genres: string[] }) {
  return (
    <section className={`${styles.sidePanel} ${styles.genresPanel}`}>
      <PanelHeading title="Genres" />
      <div className={styles.genreChips}>
        {genres.slice(0, 10).map((genre) => (
          <Link
            key={genre}
            href={`/library?genre=${encodeURIComponent(genre)}`}
          >
            {genre}
          </Link>
        ))}
      </div>
      <Link href="/library" className={styles.panelFooterLink}>
        View all
      </Link>
    </section>
  );
}

function RecentlyReviewed({ films }: { films: LibraryFilm[] }) {
  return (
    <section className={`${styles.sidePanel} ${styles.recentPanel}`}>
      <PanelHeading title="Recently Reviewed" />
      <div className={styles.recentList}>
        {films.length ? (
          films.map((film) => (
            <Link
              href={`/films/${film.id}`}
              className={styles.recentRow}
              key={film.id}
            >
              <span className={styles.recentPoster}>
                {film.posterPath ? (
                  <Image
                    src={tmdbImage(film.posterPath, "w185")!}
                    alt=""
                    fill
                    sizes="56px"
                    className="object-cover"
                  />
                ) : null}
              </span>
              <span className={styles.recentCopy}>
                <strong>{film.title}</strong>
                <span>
                  <b>★</b> {scoreOutOfFive(film.overall).toFixed(1)}
                  {film.runtime ? (
                    <i>
                      <ClockIcon /> {formatRuntime(film.runtime)}
                    </i>
                  ) : null}
                </span>
              </span>
            </Link>
          ))
        ) : (
          <p className={styles.recentEmpty}>Rated films will appear here.</p>
        )}
      </div>
      <Link href="/dashboard" className={styles.panelFooterLink}>
        View all activity
      </Link>
    </section>
  );
}

function SectionHeading({ title, href }: { title: string; href: string }) {
  return (
    <div className={styles.sectionHeading}>
      <h2>{title}</h2>
      <Link href={href}>
        See all <ChevronRightIcon />
      </Link>
    </div>
  );
}

function PanelHeading({ title, href }: { title: string; href?: string }) {
  return (
    <div className={styles.panelHeading}>
      <h2>{title}</h2>
      {href ? (
        <Link href={href}>
          See all <ChevronRightIcon />
        </Link>
      ) : null}
    </div>
  );
}

function Avatar({ initials, index }: { initials: string; index: number }) {
  return (
    <span className={styles.profileAvatar} data-tone={index % 5}>
      {initials}
    </span>
  );
}

function mostRecent(films: LibraryFilm[]) {
  return [...films].sort(
    (a, b) =>
      (b.lastWatchDate ?? "").localeCompare(a.lastWatchDate ?? "") ||
      b.id - a.id,
  );
}

function FilmThumb({ film, index }: { film: LibraryFilm; index: number }) {
  return (
    <span className={styles.profileAvatar} data-tone={index % 5}>
      {film.posterPath ? (
        <Image
          src={tmdbImage(film.posterPath, "w185")!}
          alt=""
          fill
          sizes="34px"
          className="object-cover"
        />
      ) : (
        titleInitials(film.title)
      )}
    </span>
  );
}

function titleInitials(title: string) {
  return title
    .split(/\s+/)
    .filter((word) => !/^(a|an|the)$/i.test(word))
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function uniqueFilms(films: LibraryFilm[]) {
  return [...new Map(films.map((film) => [film.id, film])).values()];
}

function uniqueGenres(film: LibraryFilm) {
  return [
    ...new Set(
      [
        ...(film.tmdbGenres ?? []),
        film.genrePrimary,
        film.genreSecondary,
      ].filter((value): value is string => Boolean(value)),
    ),
  ];
}

function normalizeGenre(genre: string) {
  return genre === "Science Fiction" ? "Sci-Fi" : genre;
}

function topGenres(films: LibraryFilm[], limit: number) {
  const counts = new Map<string, number>();
  films.forEach((film) => {
    uniqueGenres(film).forEach((genre) =>
      counts.set(genre, (counts.get(genre) ?? 0) + 1),
    );
  });
  return [...counts]
    .sort(([leftGenre, leftCount], [rightGenre, rightCount]) =>
      rightCount === leftCount
        ? leftGenre.localeCompare(rightGenre)
        : rightCount - leftCount,
    )
    .slice(0, limit)
    .map(([genre]) => genre);
}

function scoreOutOfFive(score: number | null) {
  return Math.max(0, Math.min(5, (score ?? 0) / 2));
}

function formatRuntime(runtime: number | null) {
  if (!runtime) return null;
  const hours = Math.floor(runtime / 60);
  const minutes = runtime % 60;
  return hours
    ? `${hours}h ${String(minutes).padStart(2, "0")}m`
    : `${minutes}m`;
}

function relativeWatchDate(date: string | null) {
  if (!date) return "Recently";
  const watched = new Date(`${date}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.max(
    0,
    Math.floor((today.getTime() - watched.getTime()) / 86_400_000),
  );
  if (days === 0) return "Today";
  return `${days}d ago`;
}
