import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const adminCookieName = "movie_admin_session";

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
  (await cookies()).set(adminCookieName, tokenFor(passcode), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
}

export async function requireAdminApi() {
  return (await isAdminAuthenticated())
    ? null
    : NextResponse.json({ error: "Admin authentication required." }, { status: 401 });
}
