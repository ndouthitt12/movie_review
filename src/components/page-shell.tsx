import Link from "next/link";
import Image from "next/image";
import { Suspense, type ReactNode } from "react";
import { BottomNav } from "@/components/ui/bottom-nav";
import { BellIcon, ChevronDownIcon, SearchIcon } from "@/components/ui/icons";
import { Wordmark } from "@/components/ui/wordmark";
import styles from "./page-shell.module.css";

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen pb-20 md:pb-0">
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link href="/" aria-label="Reeler home" className={styles.brand}>
            <Wordmark />
          </Link>
          <nav aria-label="Primary navigation" className={styles.nav}>
            <Link href="/" className={styles.activeNavLink}>
              Discover
            </Link>
            <Link href="/library">Reviews</Link>
            <Link href="/library?status=to_watch">Watchlist</Link>
            <Link href="/library">Lists</Link>
            <Link href="/dashboard">News</Link>
          </nav>

          <form action="/library" className={styles.search} role="search">
            <SearchIcon className="h-5 w-5" />
            <input
              name="q"
              aria-label="Search movies, reviews, and people"
              placeholder="Search movies, reviews, people..."
            />
          </form>

          <div className={styles.accountArea}>
            <button
              type="button"
              className={styles.iconButton}
              aria-label="Notifications"
            >
              <BellIcon className="h-5 w-5" />
            </button>
            <button
              type="button"
              className={styles.userChip}
              aria-label="Open account menu"
            >
              <span className={styles.avatar}>AM</span>
              <span>Ava Morgan</span>
              <ChevronDownIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>
      <main className={styles.main}>{children}</main>
      <footer className="border-hairline mt-12 border-t">
        <div className="text-paper-500 mx-auto flex max-w-7xl flex-col gap-4 px-5 py-8 text-xs leading-5 sm:px-8 md:flex-row md:items-center">
          <a
            href="https://www.themoviedb.org"
            target="_blank"
            rel="noreferrer"
            className="shrink-0"
          >
            <Image
              src="/tmdb.svg"
              alt="The Movie Database"
              width={70}
              height={30}
              className="h-[30px] w-auto"
            />
          </a>
          <p>
            This product uses the TMDB API but is not endorsed or certified by
            TMDB. Film metadata and imagery are cached locally for this personal
            library.
          </p>
        </div>
      </footer>
      <Suspense fallback={null}>
        <BottomNav />
      </Suspense>
    </div>
  );
}

export function Hairline({ className = "" }: { className?: string }) {
  return <hr className={`border-hairline border-0 border-t ${className}`} />;
}
