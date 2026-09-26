import { getRecommendations } from "@/lib/recs-server";
import { getScoreScale } from "@/lib/score-scale";

export async function GET(request: Request) {
  const limit = Number(new URL(request.url).searchParams.get("limit") ?? 20);
  return Response.json(await getRecommendations(await getScoreScale(), limit));
}
