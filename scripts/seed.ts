import "dotenv/config";
import { createDb } from "../src/db";
import { defaultRubric, defaultWeights } from "../src/db/seed-data";
import { settings } from "../src/db/schema";

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
  console.log("Default weights and rating rubric seeded.");
} finally {
  sqlite.close();
}
