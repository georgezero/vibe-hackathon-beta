import { defineConfig, devices } from "@playwright/test";

const port = 3230;
const origin = `http://localhost:${port}`;
const databaseFile = "/tmp/vibe-hackathon-c1-playwright.db";

export default defineConfig({
  testDir: "./tests/playwright",
  testMatch: "**/submission-onboarding.spec.ts",
  timeout: 30_000,
  workers: 1,
  use: { baseURL: origin },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `rm -f ${databaseFile} ${databaseFile}-shm ${databaseFile}-wal && DB_FILE_NAME=${databaseFile} npm run db:push && npm run dev -- -p ${port}`,
    url: origin,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      NODE_ENV: "test",
      BETTER_AUTH_SECRET: "phase-c1-playwright-secret-32-chars",
      BETTER_AUTH_URL: origin,
      VIBE_HACKATHON_BASE_URL: origin,
      DB_FILE_NAME: databaseFile,
      VIBE_TEST_DATABASE_ROOT: "/tmp",
      VIBY_BASE_URL: "http://localhost:3231",
      VIBY_APP_SLUG: "vibe-hackathon",
      VIBY_CLIENT_SECRET: "phase-c1-viby-client-secret",
      VIBY_CALLBACK_STATE_SECRET: "phase-c1-callback-secret-32-characters",
      VIBE_VIBY_SESSION_MODE: "better-auth",
    },
  },
});
