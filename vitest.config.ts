import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "app",
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    include: ["lib/**/*.test.ts", "app/**/*.test.ts"],
    // packages/* run through their own vitest config via `npm run test -w`.
    exclude: ["node_modules/**", "packages/**", "Three Layer Day Board Design/**"],
  },
});
