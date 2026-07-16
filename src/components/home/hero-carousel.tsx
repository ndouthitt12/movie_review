"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PlayIcon,
  PlusIcon,
} from "@/components/ui/icons";
import { Stars } from "@/components/ui/stars";
import { tmdbImage } from "@/lib/tmdb";
import styles from "@/app/home.module.css";

export type HeroFilm = {
  id: number;
  title: string;
  releaseYear: number;
  status: "watched" | "to_watch" | "to_rewatch";
  genres: string[];
  runtime: number | null;
  overview: string;
  backdropPath: string | null;
  score: number;
  trailerKey: string | null;
};

export function HeroCarousel({ films }: { films: HeroFilm[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [trailerOpen, setTrailerOpen] = useState(false);
  const film = films[index];

  useEffect(() => {
    if (paused || films.length < 2) return;
    const timer = window.setInterval(
      () => setIndex((current) => (current + 1) % films.length),
      8_000,
    );
    return () => window.clearInterval(timer);
  }, [films.length, paused]);

  useEffect(() => {
    if (!trailerOpen) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setTrailerOpen(false);
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [trailerOpen]);

  if (!film) return null;
  const backdrop = tmdbImage(film.backdropPath, "original");
  const distribution = ratingDistribution(film.score);
  const meta = [
    film.genres.slice(0, 2).join(", "),
    String(film.releaseYear),
    formatRuntime(film.runtime),
  ].filter(Boolean);

  function go(direction: number) {
    setIndex((current) =>
      (current + direction + films.length) % films.length,
    );
    setTrailerOpen(false);
  }

  return (
    <section
      className={styles.hero}
      aria-labelledby="featured-title"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false);
      }}
    >
      {backdrop ? (
        <Image
          key={backdrop}
          src={backdrop}
          alt=""
          fill
          priority={index === 0}
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
          {meta.map((item, metaIndex) => (
            <span key={item}>
              {metaIndex ? <i aria-hidden="true">•</i> : null}
              {item}
            </span>
          ))}
        </p>
        <p className={styles.synopsis}>
          {film.overview ||
            "A standout selection from your personal film library, ready to revisit and rate."}
        </p>
        <p className={styles.attribution}>— Your Reeler library</p>
        <div className={styles.heroActions}>
          {film.trailerKey ? (
            <button
              type="button"
              className={styles.primaryAction}
              onClick={() => setTrailerOpen(true)}
            >
              <PlayIcon />
              Watch Trailer
            </button>
          ) : null}
          <WatchlistButton key={film.id} film={film} />
        </div>
      </div>

      <Link
        href={`/films/${film.id}`}
        className={styles.scorePanelLink}
        aria-label={`Open ${film.title} rating breakdown`}
      >
        <ScorePanel score={film.score} distribution={distribution} />
      </Link>

      {films.length > 1 ? (
        <>
          <button
            type="button"
            className={`${styles.carouselArrow} ${styles.arrowLeft}`}
            aria-label="Previous featured film"
            onClick={() => go(-1)}
          >
            <ChevronLeftIcon />
          </button>
          <button
            type="button"
            className={`${styles.carouselArrow} ${styles.arrowRight}`}
            aria-label="Next featured film"
            onClick={() => go(1)}
          >
            <ChevronRightIcon />
          </button>
          <div className={styles.carouselDots} aria-label="Featured films">
            {films.map((item, dotIndex) => (
              <button
                type="button"
                key={item.id}
                className={dotIndex === index ? styles.activeDot : undefined}
                aria-label={`Show ${item.title}`}
                aria-current={dotIndex === index ? "true" : undefined}
                onClick={() => {
                  setIndex(dotIndex);
                  setTrailerOpen(false);
                }}
              />
            ))}
          </div>
        </>
      ) : null}

      {trailerOpen && film.trailerKey ? (
        <div
          className={styles.trailerBackdrop}
          role="dialog"
          aria-modal="true"
          aria-label={`${film.title} trailer`}
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setTrailerOpen(false);
          }}
        >
          <div className={styles.trailerDialog}>
            <button
              type="button"
              aria-label="Close trailer"
              onClick={() => setTrailerOpen(false)}
            >
              Close
            </button>
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${film.trailerKey}?autoplay=1`}
              title={`${film.title} trailer`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}

function WatchlistButton({ film }: { film: HeroFilm }) {
  const [status, setStatus] = useState(film.status);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function toggle() {
    const nextStatus =
      status === "to_watch"
        ? film.status === "to_watch"
          ? "watched"
          : film.status
        : "to_watch";
    const previous = status;
    setStatus(nextStatus);
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/films/${film.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!response.ok) throw new Error("Could not update watchlist.");
    } catch (caught) {
      setStatus(previous);
      setError(
        caught instanceof Error ? caught.message : "Could not update watchlist.",
      );
    } finally {
      setSaving(false);
    }
  }

  const inWatchlist = status === "to_watch";
  return (
    <>
      <button
        type="button"
        className={styles.secondaryAction}
        onClick={toggle}
        disabled={saving}
      >
        <PlusIcon />
        {saving
          ? "Updating..."
          : inWatchlist
            ? "In Watchlist ✓"
            : "Add to Watchlist"}
      </button>
      {error ? <span className="sr-only" role="alert">{error}</span> : null}
    </>
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
      <p className={styles.scoreLabel}>Your Score</p>
      <p className={styles.verdict}>{scoreVerdict(score)}</p>
      <Stars value={score} className={styles.heroStars} />
      <p className={styles.ratingCount}>Open the full rating breakdown</p>
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

function scoreVerdict(score: number) {
  if (score >= 4.5) return "Great";
  if (score >= 4) return "Very Good";
  if (score >= 3) return "Good";
  if (score >= 2) return "Mixed";
  return "Not Rated";
}

function formatRuntime(runtime: number | null) {
  if (!runtime) return null;
  const hours = Math.floor(runtime / 60);
  const minutes = runtime % 60;
  return hours
    ? `${hours}h ${String(minutes).padStart(2, "0")}m`
    : `${minutes}m`;
}
