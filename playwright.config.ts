import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PLAYWRIGHT_PORT ?? 3200);
const applicationOrigin = `http://localhost:${port}`;
const databaseFile = process.env.PLAYWRIGHT_DB_FILE
  ?? `/tmp/vibe-hackathon-playwright-${process.pid}.db`;

process.env.PLAYWRIGHT_DB_FILE = databaseFile;

export default defineConfig({
  testDir: "./tests/playwright",
  testIgnore: process.env.VIBE_ENABLE_ADMIN_DEV_FALLBACK === "true"
    ? []
    : ["**/viby-admin-dev-fallback.spec.ts", "**/viby-better-auth-phase-b.spec.ts"],
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  use: {
    baseURL: applicationOrigin,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
          ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
          : undefined,
      },
    },
  ],
  webServer: {
    command: `npm run db:push && npm run dev -- -p ${port}`,
    url: `http://localhost:${port}`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      BETTER_AUTH_SECRET: "playwright-better-auth-secret-at-least-32-characters",
      BETTER_AUTH_URL: applicationOrigin,
      VIBE_HACKATHON_BASE_URL: applicationOrigin,
      DB_FILE_NAME: databaseFile,
      VIBE_TEST_DATABASE_ROOT: "/tmp",
      VIBY_BASE_URL: "http://localhost:3201",
      VIBY_APP_SLUG: "vibe-hackathon",
      VIBY_CALLBACK_STATE_SECRET: "playwright-callback-state-secret-at-least-32-characters",
      VIBE_ADMIN_VIBY_USER_IDS: "allowlisted-viby-user dev_fallback",
      VIBE_ADMIN_SESSION_SECRET: "playwright-admin-session-secret",
      VIBE_ENABLE_ADMIN_DEV_FALLBACK: process.env.VIBE_ENABLE_ADMIN_DEV_FALLBACK ?? "false",
      VIBE_ADMIN_COOKIE_SECURE: "false",
      ADMIN_TOKEN: "playwright-admin-dev-fallback-secret",
    },
  },
});
