import { NextResponse } from "next/server";
import { getTmdbMovie, TmdbError } from "@/lib/tmdb-server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1)
    return NextResponse.json(
      { error: "Invalid TMDB movie id." },
      { status: 400 },
    );
  try {
    return NextResponse.json(await getTmdbMovie(id));
  } catch (error) {
    const status = error instanceof TmdbError ? error.status : 500;
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "TMDB request failed.",
      },
      { status },
    );
  }
}
