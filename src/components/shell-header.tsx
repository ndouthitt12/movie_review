"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useCommandPalette } from "@/components/command-palette";
import { isNavItemActive, primaryNav } from "@/components/nav-items";
import {
  BellIcon,
  LoginIcon,
  PlusIcon,
  SearchIcon,
} from "@/components/ui/icons";
import { Wordmark } from "@/components/ui/wordmark";
import { loginHref, useIsOwner } from "@/lib/use-is-owner";
import styles from "./page-shell.module.css";

type Activity = {
  key: string;
  filmId: number;
  title: string;
  date: string;
  detail: string;
};

export function ShellHeader({ displayName }: { displayName: string }) {
  const pathname = usePathname();
  const owner = useIsOwner();
  const { openPalette } = useCommandPalette();
  const accountRef = useRef<HTMLDivElement>(null);
  const activityRef = useRef<HTMLDivElement>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);

  useEffect(() => {
    function closeMenus(event: PointerEvent) {
      const target = event.target as Node;
      if (!accountRef.current?.contains(target)) setAccountOpen(false);
      if (!activityRef.current?.contains(target)) setActivityOpen(false);
    }
    document.addEventListener("pointerdown", closeMenus);
    return () => document.removeEventListener("pointerdown", closeMenus);
  }, []);

  async function logOut() {
    await fetch("/api/admin/logout", { method: "POST" });
    // A full load, so every page drops its edit controls.
    window.location.assign(pathname);
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
        <Link href="/" aria-label="Reeler rankings" className={styles.brand}>
          <Wordmark />
        </Link>

        <nav aria-label="Primary navigation" className={styles.nav}>
          {primaryNav.map((item) => {
            const active = isNavItemActive(item, pathname);
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

        <button
          type="button"
          className={styles.command}
          onClick={() => openPalette("jump")}
          aria-label="Search films or jump to a page"
          aria-keyshortcuts="Control+K"
        >
          <SearchIcon className="h-4 w-4 shrink-0" />
          <span className={styles.commandText}>
            Search films or jump to a page
          </span>
          <kbd>Ctrl K</kbd>
        </button>

        {owner ? (
          <button
            type="button"
            className={styles.rate}
            onClick={() => openPalette("rate")}
          >
            <PlusIcon className="h-4 w-4" />
            Rate a film
          </button>
        ) : (
          <Link href={loginHref(pathname)} className={styles.login}>
            <LoginIcon className="h-4 w-4" />
            Log in
          </Link>
        )}

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
                    onClick={() => setActivityOpen(false)}
                  >
                    <strong>{item.title}</strong>
                    <span>
                      {item.detail} · {formatActivityDate(item.date)}
                    </span>
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
          {owner ? (
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
              </button>
              {accountOpen ? (
                <div className={styles.accountDropdown}>
                  <p className={styles.menuTitle}>{displayName}</p>
                  <Link href="/settings" onClick={() => setAccountOpen(false)}>
                    Settings
                  </Link>
                  <Link href="/admin" onClick={() => setAccountOpen(false)}>
                    Admin
                  </Link>
                  <button
                    type="button"
                    className={styles.menuButton}
                    onClick={logOut}
                  >
                    Log out
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}

function formatActivityDate(value: string) {
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(date);
}
