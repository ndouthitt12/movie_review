import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const adminCookieName = "movie_admin_session";
// Readable by the page, so it can show edit controls. It grants nothing:
// every change still needs the httpOnly session cookie above.
export const ownerHintCookieName = "reeler_owner";
const sessionMaxAge = 60 * 60 * 24 * 30;

function configuredPasscode() {
  return process.env.ADMIN_PASSCODE ?? null;
}

function tokenFor(passcode: string) {
  return createHash("sha256")
    .update(`movie-rating-admin:${passcode}`)
    .digest("hex");
}

export function verifyAdminPasscode(candidate: string) {
  const expected = configuredPasscode();
  if (!expected) return false;
  const left = Buffer.from(tokenFor(candidate));
  const right = Buffer.from(tokenFor(expected));
  return left.length === right.length && timingSafeEqual(left, right);
}

export function adminAuthConfigured() {
  return Boolean(configuredPasscode());
}

export async function isAdminAuthenticated() {
  const passcode = configuredPasscode();
  if (!passcode) return false;
  return (await cookies()).get(adminCookieName)?.value === tokenFor(passcode);
}

export async function setAdminSession() {
  const passcode = configuredPasscode();
  if (!passcode) throw new Error("ADMIN_PASSCODE is not configured.");
  const store = await cookies();
  const secure = process.env.NODE_ENV === "production";
  store.set(adminCookieName, tokenFor(passcode), {
    httpOnly: true,
    sameSite: "strict",
    secure,
    path: "/",
    maxAge: sessionMaxAge,
  });
  store.set(ownerHintCookieName, "1", {
    httpOnly: false,
    sameSite: "strict",
    secure,
    path: "/",
    maxAge: sessionMaxAge,
  });
}

export async function clearAdminSession() {
  const store = await cookies();
  store.delete(adminCookieName);
  store.delete(ownerHintCookieName);
}

/** Returns a 401 response unless the owner is logged in, else null. */
export async function requireAdminApi() {
  return (await isAdminAuthenticated())
    ? null
    : NextResponse.json({ error: "Log in to make changes." }, { status: 401 });
}
