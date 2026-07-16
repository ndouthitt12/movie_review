"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useFilmActions } from "@/components/film-actions-provider";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/ui/icons";
import { tmdbImage } from "@/lib/tmdb";
import styles from "@/app/home.module.css";

export type HomePoster = {
  key: string;
  tmdbId: number | null;
  libraryFilmId: number | null;
  title: string;
  year?: number | null;
  posterPath: string;
  rating: number;
  reason?: string;
  badge?: string;
};

export function PosterRail({
  items,
  showMeta = false,
}: {
  items: HomePoster[];
  showMeta?: boolean;
}) {
  const railRef = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState(false);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const measure = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;
    const nextOverflow = rail.scrollWidth > rail.clientWidth + 2;
    setOverflow(nextOverflow);
    setAtStart(rail.scrollLeft <= 2);
    setAtEnd(
      !nextOverflow || rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 2,
    );
  }, []);

  useEffect(() => {
    measure();
    const observer = new ResizeObserver(measure);
    if (railRef.current) observer.observe(railRef.current);
    return () => observer.disconnect();
  }, [items.length, measure]);

  function scroll(direction: number) {
    railRef.current?.scrollBy({
      left: direction * railRef.current.clientWidth * 0.78,
      behavior: "smooth",
    });
  }

  return (
    <div className={styles.posterRailWrap}>
      <div className={styles.posterRail} ref={railRef} onScroll={measure}>
        {items.map((item) => (
          <PosterCard key={item.key} item={item} showMeta={showMeta} />
        ))}
      </div>
      {overflow && !atStart ? (
        <button
          type="button"
          className={`${styles.railArrow} ${styles.railArrowLeft}`}
          aria-label="Scroll films left"
          onClick={() => scroll(-1)}
        >
          <ChevronLeftIcon />
        </button>
      ) : null}
      {overflow && !atEnd ? (
        <button
          type="button"
          className={`${styles.railArrow} ${styles.railArrowRight}`}
          aria-label="Scroll films right"
          onClick={() => scroll(1)}
        >
          <ChevronRightIcon />
        </button>
      ) : null}
    </div>
  );
}

export function PosterGrid({ items }: { items: HomePoster[] }) {
  return (
    <div className={styles.posterGrid}>
      {items.map((item) => (
        <PosterCard key={item.key} item={item} showMeta showTitle />
      ))}
    </div>
  );
}

function PosterCard({
  item,
  showMeta = false,
  showTitle = false,
}: {
  item: HomePoster;
  showMeta?: boolean;
  showTitle?: boolean;
}) {
  const { openTmdbMovie } = useFilmActions();
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
      {item.libraryFilmId ? (
        <Link
          href={`/films/${item.libraryFilmId}`}
          className={styles.posterCard}
          aria-label={`Open ${item.title}`}
        >
          {content}
        </Link>
      ) : (
        <button
          type="button"
          className={styles.posterCard}
          aria-label={`Add ${item.title} to your library`}
          onClick={() => {
            if (item.tmdbId)
              openTmdbMovie({ tmdbId: item.tmdbId, title: item.title });
          }}
        >
          {content}
        </button>
      )}
      {showMeta || showTitle ? (
        <div className={styles.posterMeta}>
          {showTitle ? (
            <strong className={styles.posterTitle}>
              {item.title}
              {item.year ? ` (${item.year})` : ""}
            </strong>
          ) : null}
          {item.badge ? (
            <span className={styles.posterMetaBadge}>{item.badge}</span>
          ) : null}
          {item.reason ? <p>{item.reason}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
