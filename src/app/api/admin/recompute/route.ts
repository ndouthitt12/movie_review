import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { commitPublishedRecompute, preparePublishedRecompute, recomputeSummary } from "@/lib/recompute";

export async function POST(request: Request) {
  const unauthorized = await requireAdminApi();
  if (unauthorized) return unauthorized;
  const body = (await request.json().catch(() => ({}))) as { commit?: boolean };
  try {
    const prepared = body.commit ? commitPublishedRecompute() : preparePublishedRecompute();
    return NextResponse.json({ ...recomputeSummary(prepared.rows), committed: Boolean(body.commit) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not recompute ratings." }, { status: 400 });
  }
}
