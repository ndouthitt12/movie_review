import { getTrending } from "@/lib/recs-server";

export async function GET(request: Request) {
  const limit = Number(new URL(request.url).searchParams.get("limit") ?? 100);
  return Response.json(await getTrending(limit));
}
