import { defineConfig, devices } from "@playwright/test";

// Run with `npm run test:e2e` (builds first). Uses the installed Google Chrome: no browser download.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3123",
    channel: "chrome",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "rules", testMatch: /rules\.spec\.ts/ },
    { name: "desktop", testIgnore: /rules\.spec\.ts|phone\.spec\.ts/, use: { viewport: { width: 1280, height: 900 } } },
    { name: "phone", testMatch: /phone\.spec\.ts/, use: { ...devices["Pixel 5"], viewport: { width: 360, height: 740 }, channel: "chrome" } },
  ],
  webServer: {
    command: "npx next start -p 3123",
    url: "http://localhost:3123/login",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
