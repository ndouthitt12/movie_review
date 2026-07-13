import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="bg-ink-950 min-h-screen">
      <header className="border-hairline border-b">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link
            href="/"
            className="text-paper-100 font-serif text-xl font-semibold tracking-tight"
          >
            Picture House
          </Link>
          <nav
            aria-label="Primary navigation"
            className="text-paper-500 flex items-center gap-5 text-sm"
          >
            <Link
              href="/library"
              className="hover:text-accent-300 transition-colors duration-150"
            >
              Library
            </Link>
            <Link
              href="/dev/tokens"
              className="hover:text-accent-300 transition-colors duration-150"
            >
              Design tokens
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
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
              width={34}
              height={34}
              className="h-auto w-[34px]"
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
