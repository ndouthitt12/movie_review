import "dotenv/config";
import { createDb } from "../src/db";
import {
  defaultRubric,
  defaultWeights,
  starterRcaTags,
} from "../src/db/seed-data";
import { rcaTags, settings } from "../src/db/schema";

const { db, sqlite } = createDb();
try {
  db.insert(settings)
    .values({ id: 1, weights: defaultWeights, rubric: defaultRubric })
    .onConflictDoUpdate({
      target: settings.id,
      set: {
        weights: defaultWeights,
        rubric: defaultRubric,
        updatedAt: new Date().toISOString(),
      },
    })
    .run();
  db.insert(rcaTags)
    .values(
      starterRcaTags.map(([attribute, label, polarity]) => ({
        attribute,
        label,
        polarity,
      })),
    )
    .onConflictDoNothing()
    .run();
  console.log("Default weights, rating rubric, and RCA tags seeded.");
} finally {
  sqlite.close();
}
