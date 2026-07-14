import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-hairline bg-ink-850/95 sticky top-0 z-50 border-b shadow-lg backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link
            href="/"
            className="text-paper-100 flex items-center gap-2.5 text-lg font-bold tracking-tight"
          >
            <span className="flex items-center gap-1" aria-hidden="true">
              <span className="bg-accent-400 h-2.5 w-2.5 rounded-full" />
              <span className="bg-positive h-2.5 w-2.5 rounded-full" />
              <span className="bg-sky h-2.5 w-2.5 rounded-full" />
            </span>
            Picture House
          </Link>
          <nav
            aria-label="Primary navigation"
            className="text-paper-300 flex items-center gap-5 text-xs font-semibold tracking-wide uppercase"
          >
            <Link
              href="/dashboard"
              className="hover:text-paper-100 transition-colors duration-150"
            >
              Dashboard
            </Link>
            <Link
              href="/library"
              className="hover:text-paper-100 transition-colors duration-150"
            >
              Library
            </Link>
            <Link
              href="/rubric"
              className="hover:text-paper-100 hidden transition-colors duration-150 sm:block"
            >
              Rubric
            </Link>
            <Link
              href="/admin/rca"
              className="hover:text-paper-100 hidden transition-colors duration-150 md:block"
            >
              Why tags
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
        {children}
      </main>
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
    </div>
  );
}

export function Hairline({ className = "" }: { className?: string }) {
  return <hr className={`border-hairline border-0 border-t ${className}`} />;
}
