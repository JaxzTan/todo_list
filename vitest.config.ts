import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Mirrors tsconfig.json's "@/*" -> "./*" — needed once a test (or a
    // route.ts it imports) uses the "@/" alias instead of a relative path.
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    name: "app",
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    include: ["lib/**/*.test.ts", "app/**/*.test.ts"],
    // packages/* run through their own vitest config via `npm run test -w`.
    exclude: ["node_modules/**", "packages/**", "Three Layer Day Board Design/**"],
  },
});
