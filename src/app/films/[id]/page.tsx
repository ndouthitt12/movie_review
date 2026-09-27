import Image from "next/image";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { FilmEditor } from "@/components/film/film-editor";
import { RatingEditor } from "@/components/film/rating-editor";
import { WatchLog } from "@/components/film/watch-log";
import { PageShell } from "@/components/page-shell";
import { RouteContentLoading } from "@/components/route-content-loading";
import { Stars } from "@/components/ui/stars";
import { getFilmDetail } from "@/lib/catalog";
import { getPublishedRuntimeForm } from "@/lib/form-config";
import { getRcaTagsWithUsage } from "@/lib/rca";
import { formatRuntime } from "@/lib/runtime-format";
import { formatScore } from "@/lib/score-format";
import { getScoreScale } from "@/lib/score-scale";
import { getFilmGenres } from "@/lib/genres";
import { tmdbImage } from "@/lib/tmdb";

const statusLabels: Record<string, string> = {
  watched: "Watched",
  to_watch: "On your watchlist",
  to_rewatch: "To rewatch",
};

// No unstable_instant here. Its runtime prefetch check made `next build`
// hang on this page (Next.js 16.2.10), so production deploys failed.

type FilmPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ rate?: string | string[] }>;
};

export default function FilmPage({ params, searchParams }: FilmPageProps) {
  return (
    <PageShell>
      <Suspense fallback={<RouteContentLoading label="Loading film details" />}>
        <FilmContent params={params} searchParams={searchParams} />
      </Suspense>
    </PageShell>
  );
}

async function FilmContent({ params, searchParams }: FilmPageProps) {
  const id = Number((await params).id);
  // "Rate a film" links here with ?rate=1 to open the rating form.
  const startRating = (await searchParams).rate === "1";
  if (!Number.isInteger(id)) notFound();
  const [detail, rcaTags, publishedForm, scale] = await Promise.all([
    getFilmDetail(id),
    getRcaTagsWithUsage(),
    Promise.resolve(getPublishedRuntimeForm()),
    getScoreScale(),
  ]);
  if (!detail || !publishedForm) notFound();
  const { film, rating, answers, form, watches, selectedRcaTags } = detail;
  const initialAnswers = Object.fromEntries(
    answers.map((answer) => [
      answer.questionId,
      {
        number: answer.valueNumber,
        text: answer.valueText,
        optionIds: answer.valueOptionIds,
        isNa: answer.isNa,
      },
    ]),
  );
  const backdrop = tmdbImage(film.backdropPath, "original");
  const poster = tmdbImage(film.posterPath, "w500");

  return (
    <>
      <BackLink
        fallbackHref="/library"
        fallbackLabel="Library"
        className="type-label text-paper-500 hover:text-accent-400 -my-3 inline-block py-3 tracking-widest uppercase transition-colors"
      />
      <section className="panel relative mt-5 overflow-hidden md:min-h-[31rem]">
        {backdrop ? (
          <Image
            src={backdrop}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover opacity-25"
          />
        ) : null}
        <div className="from-ink-950/95 via-ink-950/80 to-ink-950/65 absolute inset-0 bg-gradient-to-r" />
        <div className="film-grain absolute inset-0 opacity-10" />
        {/* Phones put a small poster beside the title, then the score, then
            the overview, so the score shows on the first screen. From md up
            the text is one column beside a large poster. */}
        <div className="relative z-10 grid grid-cols-[6rem_1fr] items-center gap-x-5 gap-y-6 p-5 sm:grid-cols-[9rem_1fr] sm:p-10 md:min-h-[31rem] md:grid-cols-[14rem_1fr] md:gap-8 lg:gap-12">
          <div className="poster-frame relative aspect-[2/3] w-full overflow-hidden">
            {poster ? (
              <Image
                src={poster}
                alt={`${film.title} poster`}
                fill
                priority
                sizes="(max-width: 639px) 96px, (max-width: 767px) 144px, 224px"
                className="object-cover"
              />
            ) : (
              <div className="type-meta text-paper-500 flex h-full items-center justify-center p-3 text-center">
                No poster
              </div>
            )}
          </div>
          <div className="contents md:flex md:flex-col">
            <div className="md:order-1">
              <p className="type-label text-accent-400 tracking-[0.2em] uppercase">
                {statusLabels[film.status] ?? film.status}
              </p>
              <h1 className="film-hero-title text-paper-100 mt-2 max-w-4xl tracking-[-0.02em] md:mt-3">
                {film.title}
              </h1>
              <p className="type-meta text-paper-300 mt-3 md:mt-5">
                {[
                  film.genrePrimary,
                  film.genreSecondary,
                  film.releaseYear,
                  formatRuntime(film.runtime, ""),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {film.director ? (
                <p className="type-meta text-paper-500 mt-2">
                  Directed by {film.director}
                </p>
              ) : null}
            </div>
            {rating ? (
              <div className="col-span-2 flex flex-wrap items-center gap-x-3 gap-y-2 md:order-3 md:mt-7">
                <Stars
                  value={rating.overall / 2}
                  className="text-2xl sm:text-3xl"
                />
                <span className="type-score text-paper-100">
                  {formatScore(rating.overall, scale)}
                </span>
                <span className="type-body text-paper-500">/ {scale}</span>
              </div>
            ) : null}
            {film.overview ? (
              <p className="type-body border-hairline text-paper-300 col-span-2 max-w-3xl border-t pt-5 md:order-2 md:mt-6">
                {film.overview}
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <div className="mt-8 space-y-6">
        <RatingEditor
          key={film.id}
          filmId={film.id}
          filmTitle={film.title}
          genres={getFilmGenres(film)}
          status={film.status}
          publishedForm={publishedForm}
          ratedForm={form}
          initialAnswers={initialAnswers}
          initialOverall={rating?.overall ?? null}
          scale={scale}
          allRcaTags={rcaTags}
          initialRcaTags={selectedRcaTags}
          startEditing={startRating}
        />
        <WatchLog
          filmId={film.id}
          initial={watches.map(({ id: watchId, watchedOn, isRewatch }) => ({
            id: watchId,
            watchedOn,
            isRewatch,
          }))}
        />
        <FilmEditor filmId={film.id} status={film.status} notes={film.notes} />
      </div>
    </>
  );
}
