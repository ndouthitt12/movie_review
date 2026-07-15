import { getRecommendations } from "@/lib/recs-server";

export async function GET(request: Request) {
  const limit = Number(new URL(request.url).searchParams.get("limit") ?? 20);
  return Response.json(await getRecommendations(limit));
}
