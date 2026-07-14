import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FilmEditor } from "@/components/film/film-editor";
import { RatingEditor } from "@/components/film/rating-editor";
import { WatchLog } from "@/components/film/watch-log";
import { PageShell } from "@/components/page-shell";
import { getFilmDetail } from "@/lib/catalog";
import { getPublishedRuntimeForm } from "@/lib/form-config";
import { getRcaTagsWithUsage } from "@/lib/rca";
import { tmdbImage } from "@/lib/tmdb";

export const dynamic = "force-dynamic";

export default async function FilmPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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
    <PageShell>
      <Link
        href="/library"
        className="text-paper-500 hover:text-accent-300 text-xs tracking-widest uppercase"
      >
        ← Library
      </Link>
      <section className="border-hairline relative mt-5 min-h-[31rem] overflow-hidden border-y">
        {backdrop ? (
          <Image
            src={backdrop}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover opacity-30"
          />
        ) : null}
        <div className="bg-ink-950/70 absolute inset-0" />
        <div className="film-grain absolute inset-0 opacity-20" />
        <div className="relative z-10 grid min-h-[31rem] items-end gap-8 p-6 sm:p-10 md:grid-cols-[13rem_1fr]">
          <div className="rounded-ui border-hairline bg-ink-900 relative aspect-[2/3] w-36 overflow-hidden border sm:w-48 md:w-auto">
            {poster ? (
              <Image
                src={poster}
                alt={`${film.title} poster`}
                fill
                sizes="208px"
                className="object-cover"
              />
            ) : (
              <div className="text-paper-500 flex h-full items-center justify-center p-5 text-center font-serif">
                No poster
              </div>
            )}
          </div>
          <div className="pb-2">
            <p className="text-accent-300 text-xs tracking-[0.2em] uppercase">
              {film.status.replaceAll("_", " ")}
            </p>
            <h1 className="text-paper-100 mt-3 max-w-4xl font-serif text-5xl leading-none tracking-tight sm:text-7xl">
              {film.title}
            </h1>
            <p className="text-paper-300 mt-5 text-sm">
              {[
                film.releaseYear,
                film.director,
                film.runtime ? `${film.runtime} min` : null,
                film.genrePrimary,
                film.genreSecondary,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {film.overview ? (
              <p className="text-paper-300 mt-6 max-w-3xl text-sm leading-7">
                {film.overview}
              </p>
            ) : null}
            {rating ? (
              <div className="mt-7 flex items-baseline gap-3">
                <span className="text-score-high text-4xl tabular-nums">
                  {rating.overall.toFixed(3)}
                </span>
                <span className="text-paper-500 text-xs tracking-widest uppercase">
                  Overall
                </span>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <div className="mt-12 space-y-12">
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
    </PageShell>
  );
}
