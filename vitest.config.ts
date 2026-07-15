import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@\/db$/, replacement: path.resolve(root, "src/test/db.ts") },
      { find: "@", replacement: path.resolve(root, "src") },
    ],
  },
  test: { environment: "node" },
});
