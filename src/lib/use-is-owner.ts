"use client";

import { useSyncExternalStore } from "react";

// Mirrors ownerHintCookieName in admin-auth.ts. This only decides whether to
// show edit controls. The server checks the real session on every change.
const OWNER_HINT = "reeler_owner=1";

function subscribe() {
  // Logging in or out reloads the page, so there is nothing to watch.
  return () => {};
}

function readHint() {
  return document.cookie.split("; ").includes(OWNER_HINT);
}

/** True in the browser when the owner is logged in. False on the server. */
export function useIsOwner() {
  return useSyncExternalStore(subscribe, readHint, () => false);
}

/** The login page, returning to the current page afterwards. */
export function loginHref(returnTo: string) {
  return `/login?next=${encodeURIComponent(returnTo)}`;
}
