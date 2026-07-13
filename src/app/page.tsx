import Link from "next/link";
import { PageShell, Hairline } from "@/components/page-shell";

const foundations = [
  [
    "01",
    "Typed SQLite schema",
    "Films, ratings, watches, franchises, RCA tags, and settings.",
  ],
  [
    "02",
    "Exact scoring",
    "Injected weights, secondary score, and spreadsheet-style competition ranking.",
  ],
  [
    "03",
    "Verified import",
    "XLSX parsing, dry-run preview, transactional writes, and score/rank checks.",
  ],
];

export default function Home() {
  return (
    <PageShell>
      <section className="max-w-3xl py-10 sm:py-20">
        <p className="text-accent-300 mb-5 text-xs font-medium tracking-[0.22em] uppercase">
          Foundation / Phase 1
        </p>
        <h1 className="text-paper-100 font-serif text-5xl leading-[0.98] font-semibold tracking-tight sm:text-7xl">
          A private ledger for a life in film.
        </h1>
        <p className="text-paper-300 mt-7 max-w-2xl text-lg leading-8">
          The catalog is open: add films through TMDB or by hand, shape the
          watchlist, and record the scores and watches that make each title
          yours.
        </p>
      </section>

      <Hairline />

      <section
        className="grid gap-0 md:grid-cols-3"
        aria-label="Phase one foundations"
      >
        {foundations.map(([number, title, description]) => (
          <article
            key={number}
            className="border-hairline border-b py-7 md:border-r md:px-6 md:first:pl-0 md:last:border-r-0"
          >
            <span className="text-accent-300 text-xs tabular-nums">
              {number}
            </span>
            <h2 className="text-paper-100 mt-7 font-serif text-2xl">{title}</h2>
            <p className="text-paper-500 mt-3 text-sm leading-6">
              {description}
            </p>
          </article>
        ))}
      </section>

      <div className="mt-12">
        <Link
          href="/library"
          className="text-paper-100 decoration-accent-500 hover:text-accent-300 mr-7 text-sm underline underline-offset-4"
        >
          Enter the library
        </Link>
        <Link
          href="/dev/tokens"
          className="text-paper-300 decoration-hairline hover:text-accent-300 text-sm underline underline-offset-4"
        >
          Review the design system
        </Link>
      </div>
    </PageShell>
  );
}
