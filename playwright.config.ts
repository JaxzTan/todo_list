import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  // Same Neon-latency reasoning as `expect.timeout` below: a full multi-step
  // flow (several PATCH/POST round trips) can outrun the 30s default.
  timeout: 60000,
  // The app always talks to Neon (docker-compose.yml passes DATABASE_URL/
  // APP_DATABASE_URL straight through, even for local dev), so every
  // request is a real network round trip — individual API calls routinely
  // take 1.5-4.5s. Playwright's 5s default `expect` timeout is tuned for
  // local/in-process backends and fires mid-flow on multi-request actions
  // (e.g. create board -> open session) even though nothing is broken.
  expect: {
    timeout: 15000,
  },
  use: {
    baseURL: "http://localhost:3300",
    screenshot: "only-on-failure",
  },
});
