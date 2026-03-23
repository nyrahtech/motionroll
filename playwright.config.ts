import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E config for MotionRoll.
 * Run with: npx playwright test
 *
 * Requires the app to be running on localhost:3000 (start with `npm run dev`).
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "html",
  timeout: 30_000,

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    extraHTTPHeaders: {
      "x-motionroll-test-user-id": "user_test_123",
      "x-motionroll-test-user-email": "owner@test.local",
      "x-motionroll-test-user-name": "Test Owner",
    },
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  // Start the dev server before tests when not in CI
  webServer: process.env.CI
    ? undefined
    : {
        command: "npm run dev --workspace @motionroll/web",
        url: "http://localhost:3000/sign-in",
        reuseExistingServer: true,
        timeout: 60_000,
        env: {
          ...process.env,
          MOTIONROLL_TEST_AUTH_BYPASS: "true",
        },
      },
});
