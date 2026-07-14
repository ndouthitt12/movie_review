import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import { BottomNav } from "@/components/ui/bottom-nav";
import { Wordmark } from "@/components/ui/wordmark";

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen pb-20 md:pb-0">
      <header className="border-hairline bg-ink-950/95 sticky top-0 z-50 border-b">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link
            href="/"
            aria-label="Picture House home"
            className="transition-opacity hover:opacity-80"
          >
            <Wordmark />
          </Link>
          <nav
            aria-label="Primary navigation"
            className="text-paper-300 hidden items-center gap-6 text-xs font-semibold tracking-wide uppercase md:flex"
          >
            <Link
              href="/dashboard"
              className="hover:text-accent-400 transition-colors duration-150"
            >
              Dashboard
            </Link>
            <Link
              href="/library"
              className="hover:text-accent-400 transition-colors duration-150"
            >
              Library
            </Link>
            <Link
              href="/rubric"
              className="hover:text-accent-400 transition-colors duration-150"
            >
              Rubric
            </Link>
            <Link
              href="/admin/rca"
              className="hover:text-accent-400 transition-colors duration-150"
            >
              Why tags
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8 sm:py-12">
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
      <BottomNav />
    </div>
  );
}

export function Hairline({ className = "" }: { className?: string }) {
  return <hr className={`border-hairline border-0 border-t ${className}`} />;
}
