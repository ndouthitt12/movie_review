import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/admin-auth";
import { scoreScales } from "@/lib/score-format";
import { saveScoreScale } from "@/lib/score-scale";

const displaySchema = z.object({ scoreScale: z.literal(scoreScales) });

export async function PUT(request: Request) {
  const unauthorized = await requireAdminApi();
  if (unauthorized) return unauthorized;
  const parsed = displaySchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return NextResponse.json(
      { error: "Choose a scale of 5 or 10." },
      { status: 400 },
    );
  await saveScoreScale(parsed.data.scoreScale);
  return NextResponse.json({ scoreScale: parsed.data.scoreScale });
}
