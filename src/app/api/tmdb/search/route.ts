import { NextResponse } from "next/server";
import { searchTmdb, TmdbError } from "@/lib/tmdb-server";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2)
    return NextResponse.json(
      { error: "Enter at least two characters." },
      { status: 400 },
    );
  try {
    return NextResponse.json({ results: await searchTmdb(query) });
  } catch (error) {
    const status = error instanceof TmdbError ? error.status : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "TMDB search failed." },
      { status },
    );
  }
}
