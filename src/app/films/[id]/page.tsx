import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { FilmEditor } from "@/components/film/film-editor";
import { RatingEditor } from "@/components/film/rating-editor";
import { WatchLog } from "@/components/film/watch-log";
import { PageShell } from "@/components/page-shell";
import { RouteContentLoading } from "@/components/route-content-loading";
import { Stars } from "@/components/ui/stars";
import { getFilmDetail } from "@/lib/catalog";
import { getPublishedRuntimeForm } from "@/lib/form-config";
import { getRcaTagsWithUsage } from "@/lib/rca";
import { tmdbImage } from "@/lib/tmdb";

export const unstable_instant = {
  prefetch: "runtime",
  samples: [{ params: { id: "1" } }],
};

export default function FilmPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <PageShell>
      <Suspense fallback={<RouteContentLoading label="Loading film details" />}>
        <FilmContent params={params} />
      </Suspense>
    </PageShell>
  );
}

async function FilmContent({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const [detail, rcaTags, publishedForm] = await Promise.all([
    getFilmDetail(id),
    getRcaTagsWithUsage(),
    Promise.resolve(getPublishedRuntimeForm()),
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
      <Link
        href="/library"
        className="type-label text-paper-500 hover:text-accent-400 tracking-widest uppercase transition-colors"
      >
        ← Library
      </Link>
      <section className="panel relative mt-5 min-h-[31rem] overflow-hidden">
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
        <div className="relative z-10 grid min-h-[31rem] items-center gap-8 p-6 sm:p-10 md:grid-cols-[14rem_1fr] lg:gap-12">
          <div className="poster-frame relative aspect-[2/3] w-40 overflow-hidden sm:w-52 md:w-auto">
            {poster ? (
              <Image
                src={poster}
                alt={`${film.title} poster`}
                fill
                sizes="224px"
                className="object-cover"
              />
            ) : (
              <div className="type-body text-paper-500 flex h-full items-center justify-center p-5 text-center">
                No poster
              </div>
            )}
          </div>
          <div>
            <p className="type-label text-accent-400 tracking-[0.2em] uppercase">
              {film.status.replaceAll("_", " ")}
            </p>
            <h1 className="type-hero text-paper-100 mt-3 max-w-4xl tracking-[-0.04em]">
              {film.title}
            </h1>
            <p className="type-meta text-paper-300 mt-5">
              {[
                film.genrePrimary,
                film.genreSecondary,
                film.releaseYear,
                film.runtime ? `${film.runtime} min` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {film.director ? (
              <p className="type-meta text-paper-500 mt-2">
                Directed by {film.director}
              </p>
            ) : null}
            {film.overview ? (
              <p className="type-body border-hairline text-paper-300 mt-6 max-w-3xl border-t pt-5">
                {film.overview}
              </p>
            ) : null}
            {rating ? (
              <div className="mt-7 flex flex-wrap items-center gap-x-3 gap-y-2">
                <Stars
                  value={rating.overall / 2}
                  className="text-2xl sm:text-3xl"
                />
                <span className="type-score text-paper-100">
                  {(rating.overall / 2).toFixed(1)}
                </span>
                <span className="type-body text-paper-500">/ 5</span>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <div className="mt-8 space-y-6">
        <RatingEditor
          filmId={film.id}
          status={film.status}
          publishedForm={publishedForm}
          ratedForm={form}
          initialAnswers={initialAnswers}
          initialOverall={rating?.overall ?? null}
          allRcaTags={rcaTags}
          initialRcaTags={selectedRcaTags}
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
