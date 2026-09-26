export type RateQueueFilm = {
  id: number;
  title: string;
  releaseYear: number;
  posterPath: string | null;
  status: string;
  watchOrder: number | null;
  lastWatchDate: string | null;
  overall: number | null;
};

type QueueItem = Pick<
  RateQueueFilm,
  "id" | "title" | "releaseYear" | "posterPath" | "lastWatchDate"
>;

const byLatestWatch = (left: RateQueueFilm, right: RateQueueFilm) =>
  (right.lastWatchDate ?? "").localeCompare(left.lastWatchDate ?? "") ||
  right.id - left.id;

const toItem = ({
  id,
  title,
  releaseYear,
  posterPath,
  lastWatchDate,
}: RateQueueFilm): QueueItem => ({
  id,
  title,
  releaseYear,
  posterPath,
  lastWatchDate,
});

/**
 * The films "Rate a film" offers before you type: watched films with no
 * rating, then the watchlist in its saved order, then recent watches you may
 * want to re-rate.
 */
export function rateQueue(films: readonly RateQueueFilm[], limit = 5) {
  const watched = (film: RateQueueFilm) =>
    film.status === "watched" || film.status === "to_rewatch";
  return {
    unrated: films
      .filter((film) => watched(film) && film.overall === null)
      .sort(byLatestWatch)
      .slice(0, limit)
      .map(toItem),
    watchlist: films
      .filter((film) => film.status === "to_watch")
      .sort(
        (left, right) =>
          (left.watchOrder ?? Infinity) - (right.watchOrder ?? Infinity) ||
          left.title.localeCompare(right.title),
      )
      .slice(0, limit)
      .map(toItem),
    recent: films
      .filter(
        (film) => watched(film) && film.overall !== null && film.lastWatchDate,
      )
      .sort(byLatestWatch)
      .slice(0, limit)
      .map(toItem),
  };
}

export type RateQueue = ReturnType<typeof rateQueue>;
