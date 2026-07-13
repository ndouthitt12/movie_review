import Link from "next/link";
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
            aria-label="Utility navigation"
            className="text-paper-500 text-sm"
          >
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
    </div>
  );
}

export function Hairline({ className = "" }: { className?: string }) {
  return <hr className={`border-hairline border-0 border-t ${className}`} />;
}
