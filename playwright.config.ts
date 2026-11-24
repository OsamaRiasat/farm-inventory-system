import "dotenv/config";
import { defineConfig, devices } from "@playwright/test";

// Run with `npm run test:e2e` (builds first). Uses the installed Google Chrome: no browser download.
// Tests use their own database (TEST_DATABASE_URL), reset and seeded with the demo history before every run
// (e2e/global-setup.ts). Rules tests call the server services directly against the same database.
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgresql://awfarms:awfarms@localhost:5433/awfarms_test";
process.env.DATABASE_URL = TEST_DATABASE_URL;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  reporter: "list",
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: "http://localhost:3123",
    channel: "chrome",
    trace: "retain-on-failure",
  },
  // All projects share one database. "seed" checks the untouched demo data first; the rest then run in parallel
  // (rules / backend tests work on their own throwaway farms).
  projects: [
    { name: "seed", testMatch: /data\.spec\.ts/, use: { viewport: { width: 1280, height: 900 } } },
    { name: "rules", testMatch: /(rules|backend)\.spec\.ts/, dependencies: ["seed"] },
    {
      name: "desktop",
      testIgnore: /rules\.spec\.ts|backend\.spec\.ts|phone\.spec\.ts|data\.spec\.ts/,
      use: { viewport: { width: 1280, height: 900 } },
      dependencies: ["seed"],
    },
    {
      name: "phone",
      testMatch: /phone\.spec\.ts/,
      use: { ...devices["Pixel 5"], viewport: { width: 360, height: 740 }, channel: "chrome" },
      dependencies: ["seed"],
    },
  ],
  webServer: {
    command: "npx next start -p 3123",
    url: "http://localhost:3123/login",
    reuseExistingServer: false,
    timeout: 60_000,
    env: { DATABASE_URL: TEST_DATABASE_URL },
  },
});
