"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { useFilmActions } from "@/components/film-actions-provider";
import { BellIcon, ChevronDownIcon, SearchIcon } from "@/components/ui/icons";
import { Wordmark } from "@/components/ui/wordmark";
import { tmdbImage, type TmdbSearchResult } from "@/lib/tmdb";
import styles from "./page-shell.module.css";

type LibraryResult = {
  id: number;
  tmdbId: number | null;
  title: string;
  releaseYear: number;
  posterPath: string | null;
};

type Activity = {
  key: string;
  filmId: number;
  title: string;
  date: string;
  detail: string;
};

type SearchPayload = { library: LibraryResult[]; tmdb: TmdbSearchResult[] };

const navItems = [
  { label: "Discover", href: "/" },
  {
    label: "Reviews",
    href: "/library?status=rated&sort=lastWatchDate&dir=desc",
  },
  { label: "Watchlist", href: "/library?status=to_watch" },
  { label: "Lists", href: "/library" },
  { label: "News", href: "/dashboard" },
];

export function ShellHeader({ displayName }: { displayName: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { openTmdbMovie } = useFilmActions();
  const searchRef = useRef<HTMLDivElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);
  const activityRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState<SearchPayload>({ library: [], tmdb: [] });
  const [searching, setSearching] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [accountOpen, setAccountOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);

  const choices = useMemo(
    () => [
      ...search.library.map((item) => ({ type: "library" as const, item })),
      ...search.tmdb.map((item) => ({ type: "tmdb" as const, item })),
    ],
    [search],
  );

  useEffect(() => {
    if (query.trim().length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch(
          `/api/search?q=${encodeURIComponent(query.trim())}`,
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error("Search failed");
        setSearch((await response.json()) as SearchPayload);
        setActiveIndex(0);
      } catch {
        if (!controller.signal.aborted)
          setSearch({ library: [], tmdb: [] });
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 300);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  useEffect(() => {
    function closeMenus(event: MouseEvent) {
      const target = event.target as Node;
      if (!searchRef.current?.contains(target)) setSearchOpen(false);
      if (!accountRef.current?.contains(target)) setAccountOpen(false);
      if (!activityRef.current?.contains(target)) setActivityOpen(false);
    }
    document.addEventListener("mousedown", closeMenus);
    return () => document.removeEventListener("mousedown", closeMenus);
  }, []);

  function selectChoice(index: number) {
    const choice = choices[index];
    if (!choice) return;
    setSearchOpen(false);
    setQuery("");
    if (choice.type === "library") router.push(`/films/${choice.item.id}`);
    else openTmdbMovie({ tmdbId: choice.item.id, title: choice.item.title });
  }

  function onSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setSearchOpen(false);
      return;
    }
    if (!searchOpen || !choices.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % choices.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + choices.length) % choices.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      selectChoice(activeIndex);
    }
  }

  async function toggleActivity() {
    setActivityOpen((open) => !open);
    setAccountOpen(false);
    if (activity.length || activityLoading) return;
    setActivityLoading(true);
    try {
      const response = await fetch("/api/activity");
      if (response.ok) {
        const body = (await response.json()) as { activity: Activity[] };
        setActivity(body.activity);
      }
    } finally {
      setActivityLoading(false);
    }
  }

  const initials = displayName
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <Link href="/" aria-label="Reeler home" className={styles.brand}>
          <Wordmark />
        </Link>
        <nav aria-label="Primary navigation" className={styles.nav}>
          {navItems.map((item) => {
            const url = new URL(item.href, "http://reeler.local");
            const active =
              pathname === url.pathname &&
              [...url.searchParams].every(
                ([key, value]) => searchParams.get(key) === value,
              ) &&
              (item.href !== "/library" || searchParams.toString() === "");
            return (
              <Link
                href={item.href}
                key={item.label}
                className={active ? styles.activeNavLink : undefined}
                aria-current={active ? "page" : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className={styles.searchWrap} ref={searchRef}>
          <div className={styles.search} role="search">
            <SearchIcon className="h-5 w-5" />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setSearchOpen(true);
                if (event.target.value.trim().length < 2) {
                  setSearch({ library: [], tmdb: [] });
                  setSearching(false);
                }
              }}
              onFocus={() => setSearchOpen(true)}
              onKeyDown={onSearchKeyDown}
              aria-label="Search movies"
              role="combobox"
              aria-expanded={searchOpen && query.trim().length >= 2}
              aria-controls="site-search-results"
              aria-activedescendant={
                choices[activeIndex]
                  ? `search-choice-${activeIndex}`
                  : undefined
              }
              autoComplete="off"
              placeholder="Search your library and TMDB..."
            />
          </div>
          {searchOpen && query.trim().length >= 2 ? (
            <div
              id="site-search-results"
              className={styles.searchDropdown}
              role="listbox"
            >
              <SearchGroup
                title="In your library"
                items={search.library}
                offset={0}
                activeIndex={activeIndex}
                onSelect={selectChoice}
              />
              <SearchGroup
                title="On TMDB"
                items={search.tmdb}
                offset={search.library.length}
                activeIndex={activeIndex}
                onSelect={selectChoice}
              />
              {searching ? (
                <p className={styles.menuStatus}>Searching...</p>
              ) : null}
              {!searching && !choices.length ? (
                <p className={styles.menuStatus}>No matching films found.</p>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className={styles.accountArea}>
          <div className={styles.menuAnchor} ref={activityRef}>
            <button
              type="button"
              className={styles.iconButton}
              aria-label="Recent activity"
              aria-expanded={activityOpen}
              onClick={toggleActivity}
            >
              <BellIcon className="h-5 w-5" />
            </button>
            {activityOpen ? (
              <div
                className={styles.accountDropdown}
                aria-label="Recent activity menu"
              >
                <p className={styles.menuTitle}>Recent activity</p>
                {activityLoading ? (
                  <p className={styles.menuStatus}>Loading...</p>
                ) : null}
                {!activityLoading && !activity.length ? (
                  <p className={styles.menuStatus}>No activity yet.</p>
                ) : null}
                {activity.map((item) => (
                  <Link
                    href={`/films/${item.filmId}`}
                    key={item.key}
                    className={styles.activityItem}
                  >
                    <strong>{item.title}</strong>
                    <span>
                      {item.detail} · {formatActivityDate(item.date)}
                    </span>
                  </Link>
                ))}
                <Link href="/dashboard" className={styles.menuFooterLink}>
                  View dashboard
                </Link>
              </div>
            ) : null}
          </div>
          <div className={styles.menuAnchor} ref={accountRef}>
            <button
              type="button"
              className={styles.userChip}
              aria-label="Open account menu"
              aria-expanded={accountOpen}
              onClick={() => {
                setAccountOpen((open) => !open);
                setActivityOpen(false);
              }}
            >
              <span className={styles.avatar}>{initials}</span>
              <span>{displayName}</span>
              <ChevronDownIcon className="h-4 w-4" />
            </button>
            {accountOpen ? (
              <div className={styles.accountDropdown}>
                <p className={styles.menuTitle}>{displayName}</p>
                <Link href="/dashboard">Dashboard</Link>
                <Link href="/settings/rca">RCA settings</Link>
                <Link href="/admin">Admin</Link>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}

function SearchGroup({
  title,
  items,
  offset,
  activeIndex,
  onSelect,
}: {
  title: string;
  items: Array<LibraryResult | TmdbSearchResult>;
  offset: number;
  activeIndex: number;
  onSelect: (index: number) => void;
}) {
  if (!items.length) return null;
  return (
    <div className={styles.searchGroup}>
      <p>{title}</p>
      {items.map((item, index) => {
        const choiceIndex = offset + index;
        return (
          <button
            type="button"
            role="option"
            aria-selected={choiceIndex === activeIndex}
            id={`search-choice-${choiceIndex}`}
            key={item.id}
            className={
              choiceIndex === activeIndex
                ? styles.activeSearchResult
                : undefined
            }
            onClick={() => onSelect(choiceIndex)}
          >
            <span className={styles.searchPoster}>
              {item.posterPath ? (
                <Image
                  src={tmdbImage(item.posterPath, "w185")!}
                  alt=""
                  fill
                  sizes="38px"
                  className="object-cover"
                />
              ) : null}
            </span>
            <span>
              <strong>{item.title}</strong>
              <small>
                {("releaseYear" in item ? item.releaseYear : item.year) ??
                  "Year unknown"}
              </small>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function formatActivityDate(value: string) {
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(date);
}
