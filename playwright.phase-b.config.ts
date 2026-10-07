import { defineConfig, devices } from "@playwright/test";

const port = 3210;
const origin = `http://localhost:${port}`;
const databaseFile = "/tmp/vibe-hackathon-phase-b-playwright.db";
const chromiumExecutable = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
const webkitExecutable = process.env.PLAYWRIGHT_WEBKIT_EXECUTABLE;
process.env.PLAYWRIGHT_DB_FILE = databaseFile;

export default defineConfig({
  testDir: "./tests/playwright",
  testMatch: [
    "**/viby-better-auth-phase-b.spec.ts",
    "**/viby-judge-b44.spec.ts",
    "**/account-management.spec.ts",
  ],
  timeout: 30_000,
  workers: 1,
  fullyParallel: false,
  use: { baseURL: origin, trace: "on-first-retry" },
  projects: [
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"], launchOptions: chromiumExecutable ? { executablePath: chromiumExecutable } : undefined },
    },
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"], launchOptions: chromiumExecutable ? { executablePath: chromiumExecutable } : undefined },
    },
    {
      name: "webkit",
      use: {
        ...devices["Desktop Safari"],
        launchOptions: webkitExecutable ? { executablePath: webkitExecutable } : undefined,
      },
    },
  ],
  webServer: {
    command: `rm -f ${databaseFile} ${databaseFile}-shm ${databaseFile}-wal && npm run db:push && npm run dev -- -p ${port}`,
    url: origin,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      NODE_ENV: "test",
      BETTER_AUTH_SECRET: "phase-b-playwright-better-auth-secret-32-chars",
      BETTER_AUTH_URL: origin,
      VIBE_HACKATHON_BASE_URL: origin,
      DB_FILE_NAME: databaseFile,
      VIBE_TEST_DATABASE_ROOT: "/tmp",
      VIBY_BASE_URL: "http://localhost:3211",
      VIBY_APP_SLUG: "vibe-hackathon",
      VIBY_CLIENT_SECRET: "phase-b-playwright-viby-client-secret",
      VIBE_VIBY_SESSION_MODE: "better-auth",
      VIBY_CALLBACK_STATE_SECRET: "phase-b-playwright-state-secret-32-characters",
      VIBE_ADMIN_SESSION_SECRET: "phase-b-playwright-legacy-secret-32-characters",
      VIBE_ADMIN_COOKIE_SECURE: "false",
    },
  },
});
