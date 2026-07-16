import Image from "next/image";
import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  HeartIcon,
  PlayIcon,
  PlusIcon,
  VerifiedIcon,
} from "@/components/ui/icons";
import { Stars } from "@/components/ui/stars";
import { getLibraryFilms, type LibraryFilm } from "@/lib/catalog";
import { getRecommendations, getTrending } from "@/lib/recs-server";
import { tmdbImage } from "@/lib/tmdb";
import styles from "./home.module.css";

export const dynamic = "force-dynamic";

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

const reviewerProfiles = [
  {
    name: "Ethan Cole",
    initials: "EC",
    time: "2d ago",
    likes: 128,
    fallback:
      "A breathtaking experience from start to finish, with confident craft and a finale that lands beautifully.",
  },
  {
    name: "Maya Patel",
    initials: "MP",
    time: "3d ago",
    likes: 96,
    fallback:
      "Slow in parts, but the world-building and performances make this an unforgettable experience.",
  },
  {
    name: "Lucas Meyer",
    initials: "LM",
    time: "4d ago",
    likes: 77,
    fallback:
      "Bold, immersive, and emotionally resonant. One of the year's most rewarding watches.",
  },
  {
    name: "Isabella Tran",
    initials: "IT",
    time: "5d ago",
    likes: 64,
    fallback:
      "Stunning visuals and sound design that demand to be experienced on the biggest screen possible.",
  },
];

const critics = [
  { name: "Ethan Cole", initials: "EC", score: 4.8 },
  { name: "Maya Patel", initials: "MP", score: 4.5 },
  { name: "Lucas Meyer", initials: "LM", score: 4.5 },
  { name: "Isabella Tran", initials: "IT", score: 4.0 },
  { name: "James Whitman", initials: "JW", score: 3.9 },
];

type HomePoster = {
  key: string;
  title: string;
  posterPath: string;
  rating: number;
  href: string;
  external?: boolean;
  reason?: string;
  badge?: string;
};

export default async function Home() {
  const [films, recommendations, trending] = await Promise.all([
    getLibraryFilms(),
    getRecommendations(8).catch(() => null),
    getTrending(16).catch(() => null),
  ]);
  const watched = films.filter(
    ({ status }) => status === "watched" || status === "to_rewatch",
  );
  const rated = mostRecent(watched.filter(({ overall }) => overall !== null));
  const featured = rated[0] ?? mostRecent(watched)[0] ?? films[0];
  const recentRatings = rated.slice(0, 3);
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
          title: item.title,
          posterPath: item.posterPath,
          rating: item.rating,
          href: item.libraryFilmId
            ? `/films/${item.libraryFilmId}`
            : `https://www.themoviedb.org/movie/${item.tmdbId}`,
          external: item.libraryFilmId === null,
          badge: item.badge,
        }))
      : libraryPosters.map(libraryPoster);
  const recommendedPosters: HomePoster[] =
    recommendations?.available && recommendations.items.length
      ? recommendations.items.map((item) => ({
          key: `recommendation-${item.tmdbId}`,
          title: item.title,
          posterPath: item.posterPath!,
          rating: Math.max(0, Math.min(5, item.voteAverage / 2)),
          href: item.libraryFilmId
            ? `/films/${item.libraryFilmId}`
            : `https://www.themoviedb.org/movie/${item.tmdbId}`,
          external: item.libraryFilmId === null,
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
    <PageShell>
      <div className={styles.homeGrid}>
        <div className={styles.mainColumn}>
          {featured ? <Hero film={featured} /> : <EmptyHero />}

          <section className={styles.trendingSection}>
            <SectionHeading title="Trending Now" href="/library" />
            <div className={styles.posterRail}>
              {trendingPosters.map((item) => (
                <PosterCard key={item.key} item={item} />
              ))}
            </div>
          </section>

          {recommendedPosters.length ? (
            <section className={styles.recommendedSection}>
              <SectionHeading
                title={
                  recommendations?.mode === "trending"
                    ? "Popular Right Now"
                    : "Recommended For You"
                }
                href="/library"
              />
              <div className={styles.posterRail}>
                {recommendedPosters.map((item) => (
                  <PosterCard key={item.key} item={item} showMeta />
                ))}
              </div>
            </section>
          ) : null}

          <section className={styles.reviewsSection}>
            <SectionHeading title="Popular Reviews" href="/library" />
            <div className={styles.reviewGrid}>
              {reviewerProfiles.map((profile, index) => {
                const film = rated[index];
                const rating = film
                  ? scoreOutOfFive(film.overall)
                  : 4.5 - index * 0.15;
                return (
                  <article className={styles.reviewCard} key={profile.name}>
                    <div className={styles.reviewHeader}>
                      <Avatar initials={profile.initials} index={index} />
                      <div className={styles.reviewIdentity}>
                        <span>
                          {profile.name}
                          <VerifiedIcon className={styles.verifiedIcon} />
                        </span>
                        <Stars value={rating} className={styles.reviewStars} />
                      </div>
                      <time>
                        {film
                          ? relativeWatchDate(film.lastWatchDate)
                          : profile.time}
                      </time>
                    </div>
                    <p className={styles.reviewText}>
                      {film?.notes.trim() || profile.fallback}
                    </p>
                    <div className={styles.likes}>
                      <HeartIcon />
                      <span>{profile.likes}</span>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </div>

        <aside className={styles.sidebar} aria-label="Discover more">
          <TopCritics />
          <Genres genres={genres} />
          <RecentlyReviewed films={recentRatings} />
        </aside>
      </div>
    </PageShell>
  );
}

function Hero({ film }: { film: LibraryFilm }) {
  const backdrop = tmdbImage(film.backdropPath, "original");
  const score = scoreOutOfFive(film.overall);
  const distribution = ratingDistribution(score);
  const genres = uniqueGenres(film).map(normalizeGenre).slice(0, 2).join(", ");
  const meta = [
    genres,
    String(film.releaseYear),
    formatRuntime(film.runtime),
    film.releaseYear >= 2000 ? "PG-13" : null,
  ].filter(Boolean);

  return (
    <section className={styles.hero} aria-labelledby="featured-title">
      {backdrop ? (
        <Image
          src={backdrop}
          alt=""
          fill
          priority
          sizes="(max-width: 1100px) 100vw, 75vw"
          className={styles.heroImage}
        />
      ) : null}
      <div className={styles.heroFallbackBackdrop} />
      <div className={styles.heroShade} />
      <div className={styles.heroContent}>
        <p className={styles.featuredLabel}>Featured</p>
        <Link href={`/films/${film.id}`}>
          <h1 id="featured-title">{film.title}</h1>
        </Link>
        <p className={styles.heroMeta}>
          {meta.map((item, index) => (
            <span key={item}>
              {index ? <i aria-hidden="true">•</i> : null}
              {item}
            </span>
          ))}
        </p>
        <p className={styles.synopsis}>
          {film.overview?.trim() ||
            film.notes.trim() ||
            "A standout selection from your personal film library, ready to revisit and rate."}
        </p>
        <p className={styles.attribution}>— Your Reeler library</p>
        <div className={styles.heroActions}>
          <a
            href={`https://www.youtube.com/results?search_query=${encodeURIComponent(`${film.title} trailer`)}`}
            target="_blank"
            rel="noreferrer"
            className={styles.primaryAction}
          >
            <PlayIcon />
            Watch Trailer
          </a>
          <Link href={`/films/${film.id}`} className={styles.secondaryAction}>
            <PlusIcon />
            Add to Watchlist
          </Link>
        </div>
      </div>

      <ScorePanel score={score} distribution={distribution} />

      <button
        className={`${styles.carouselArrow} ${styles.arrowLeft}`}
        aria-label="Previous featured film"
      >
        <ChevronLeftIcon />
      </button>
      <button
        className={`${styles.carouselArrow} ${styles.arrowRight}`}
        aria-label="Next featured film"
      >
        <ChevronRightIcon />
      </button>
      <div className={styles.carouselDots} aria-label="Featured film 1 of 4">
        <span className={styles.activeDot} />
        <span />
        <span />
        <span />
      </div>
    </section>
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

function ScorePanel({
  score,
  distribution,
}: {
  score: number;
  distribution: number[];
}) {
  const angle = Math.max(0, Math.min(360, (score / 5) * 360));
  const totalRatings = Math.max(1, Math.round(12432 * (score / 4.6 || 0.08)));
  return (
    <div className={styles.scorePanel}>
      <div
        className={styles.scoreRing}
        style={{
          background: `conic-gradient(var(--color-accent-400) ${angle}deg, #303234 ${angle}deg)`,
        }}
      >
        <div>
          <strong>{score.toFixed(1)}</strong>
        </div>
      </div>
      <p className={styles.scoreLabel}>Reeler Score</p>
      <p className={styles.verdict}>{scoreVerdict(score)}</p>
      <Stars value={score} className={styles.heroStars} />
      <p className={styles.ratingCount}>
        Based on {totalRatings.toLocaleString()} ratings
      </p>
      <div className={styles.histogram}>
        {distribution.map((percentage, index) => {
          const rating = 5 - index;
          return (
            <div className={styles.histogramRow} key={rating}>
              <span>{rating}</span>
              <span className={styles.smallStar}>★</span>
              <span className={styles.track}>
                <span style={{ width: `${percentage}%` }} />
              </span>
              <span>{percentage}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PosterCard({
  item,
  showMeta = false,
}: {
  item: HomePoster;
  showMeta?: boolean;
}) {
  const content = (
    <>
      <Image
        src={tmdbImage(item.posterPath, "w342")!}
        alt={`${item.title} poster`}
        fill
        sizes="(max-width: 900px) 140px, 12vw"
        className={styles.posterImage}
      />
      <span className={styles.posterShade} />
      {item.badge && !showMeta ? (
        <span className={styles.posterBadge}>{item.badge}</span>
      ) : null}
      <span className={styles.posterScore}>
        <b aria-hidden="true">★</b>
        {item.rating.toFixed(1)}
      </span>
    </>
  );
  return (
    <div className={styles.posterItem}>
      {item.external ? (
        <a
          href={item.href}
          target="_blank"
          rel="noreferrer"
          className={styles.posterCard}
          aria-label={`View ${item.title} on TMDB`}
        >
          {content}
        </a>
      ) : (
        <Link
          href={item.href}
          className={styles.posterCard}
          aria-label={`Open ${item.title}`}
        >
          {content}
        </Link>
      )}
      {showMeta ? (
        <div className={styles.posterMeta}>
          {item.badge ? (
            <span className={styles.posterMetaBadge}>{item.badge}</span>
          ) : null}
          {item.reason ? <p>{item.reason}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

function libraryPoster(film: LibraryFilm): HomePoster {
  return {
    key: `library-${film.id}`,
    title: film.title,
    posterPath: film.posterPath!,
    rating: scoreOutOfFive(film.overall),
    href: `/films/${film.id}`,
  };
}

function TopCritics() {
  return (
    <section className={`${styles.sidePanel} ${styles.criticsPanel}`}>
      <PanelHeading title="Top Critics" href="/library" />
      <div className={styles.criticList}>
        {critics.map((critic, index) => (
          <div className={styles.criticRow} key={critic.name}>
            <Avatar initials={critic.initials} index={index} />
            <span className={styles.criticName}>
              {critic.name}
              <VerifiedIcon className={styles.verifiedIcon} />
            </span>
            <span className={styles.criticScore}>
              {critic.score.toFixed(1)}
            </span>
          </div>
        ))}
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
      <Link href="/library" className={styles.panelFooterLink}>
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

function scoreVerdict(score: number) {
  if (score >= 4.5) return "Great";
  if (score >= 4) return "Very Good";
  if (score >= 3) return "Good";
  if (score >= 2) return "Mixed";
  return "Not Rated";
}

function ratingDistribution(score: number) {
  if (score >= 4.4) return [66, 22, 8, 3, 1];
  const weights = [5, 4, 3, 2, 1].map((rating) =>
    Math.exp(-Math.pow(rating - score, 2) / 0.72),
  );
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const values = weights.map((weight) => Math.round((weight / total) * 100));
  values[0] += 100 - values.reduce((sum, value) => sum + value, 0);
  return values;
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
