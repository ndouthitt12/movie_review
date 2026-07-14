import { NextResponse } from "next/server";
import {
  adminAuthConfigured,
  setAdminSession,
  verifyAdminPasscode,
} from "@/lib/admin-auth";

export async function POST(request: Request) {
  if (!adminAuthConfigured())
    return NextResponse.json(
      { error: "Set ADMIN_PASSCODE before using the admin area." },
      { status: 503 },
    );
  const body = (await request.json().catch(() => null)) as {
    passcode?: unknown;
  } | null;
  if (typeof body?.passcode !== "string" || !verifyAdminPasscode(body.passcode))
    return NextResponse.json({ error: "Incorrect passcode." }, { status: 401 });
  await setAdminSession();
  return NextResponse.json({ authenticated: true });
}
