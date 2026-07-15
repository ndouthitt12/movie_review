import "./env";

const [{ db }, { seedDatabase }] = await Promise.all([
  import("../src/db"),
  import("../src/db/seed"),
]);

await seedDatabase(db);
console.log("Form v1, rating scale, and RCA tags seeded.");
