import Image from "next/image";
import { Suspense, type ReactNode } from "react";
import { FilmActionsProvider } from "@/components/film-actions-provider";
import { ShellHeader } from "@/components/shell-header";
import { BottomNav } from "@/components/ui/bottom-nav";
import styles from "./page-shell.module.css";

export function PageShell({ children }: { children: ReactNode }) {
  const displayName = process.env.SITE_OWNER_NAME?.trim() || "Site Owner";
  return (
    <FilmActionsProvider>
      <div className="min-h-screen pb-20 md:pb-0">
        <Suspense fallback={null}>
          <ShellHeader displayName={displayName} />
        </Suspense>
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
    </FilmActionsProvider>
  );
}

export function Hairline({ className = "" }: { className?: string }) {
  return <hr className={`border-hairline border-0 border-t ${className}`} />;
}
