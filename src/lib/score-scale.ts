import { eq } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/db";
import { displaySettings } from "@/db/schema";
import { toScoreScale, type ScoreScale } from "./score-format";

/** The scale the site shows overall scores on. Read once per request. */
export const getScoreScale = cache(async (): Promise<ScoreScale> => {
  const [row] = await db
    .select({ scoreScale: displaySettings.scoreScale })
    .from(displaySettings)
    .where(eq(displaySettings.id, 1));
  return toScoreScale(row?.scoreScale);
});

export async function saveScoreScale(scale: ScoreScale) {
  await db
    .insert(displaySettings)
    .values({ id: 1, scoreScale: scale })
    .onConflictDoUpdate({
      target: displaySettings.id,
      set: { scoreScale: scale },
    });
}
