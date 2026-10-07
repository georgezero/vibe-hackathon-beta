import { defineConfig, devices } from "@playwright/test";

const port = 3260;
const targetPort = 3261;
const origin = `https://localhost:${port}`;
const databaseFile = "/tmp/vibe-hackathon-d1-command-center.db";
process.env.PLAYWRIGHT_D1_DB_FILE = databaseFile;

export default defineConfig({
  testDir: "./tests/playwright",
  testMatch: "**/judging-command-center-d1.spec.ts",
  timeout: 45_000,
  workers: 1,
  fullyParallel: false,
  use: { baseURL: origin, ignoreHTTPSErrors: true, trace: "on-first-retry" },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `rm -f ${databaseFile} ${databaseFile}-shm ${databaseFile}-wal /tmp/d1-localhost-key.pem /tmp/d1-localhost-cert.pem && DB_FILE_NAME=${databaseFile} npm run db:push && openssl req -x509 -newkey rsa:2048 -nodes -keyout /tmp/d1-localhost-key.pem -out /tmp/d1-localhost-cert.pem -days 1 -subj '/CN=localhost' -addext 'subjectAltName=DNS:localhost' >/tmp/d1-openssl.log 2>&1 && chmod 600 /tmp/d1-localhost-key.pem && (npm start -- -p ${targetPort} & next_pid=$!; D1_HTTPS_PORT=${port} D1_TARGET_PORT=${targetPort} D1_KEY=/tmp/d1-localhost-key.pem D1_CERT=/tmp/d1-localhost-cert.pem node scripts/c6-https-proxy.mjs; kill $next_pid; rm -f /tmp/d1-localhost-key.pem /tmp/d1-localhost-cert.pem /tmp/d1-openssl.log)`,
    url: `http://localhost:${targetPort}`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      NODE_ENV: "test",
      BETTER_AUTH_SECRET: "phase-d1-command-center-better-auth-secret-32-chars",
      BETTER_AUTH_URL: origin,
      VIBE_HACKATHON_BASE_URL: origin,
      DB_FILE_NAME: databaseFile,
      VIBE_TEST_DATABASE_ROOT: "/tmp",
      VIBY_BASE_URL: "http://localhost:3261",
      VIBY_APP_SLUG: "vibe-hackathon",
      VIBY_CALLBACK_STATE_SECRET: "phase-d1-command-center-callback-secret-32-chars",
      VIBE_ADMIN_SESSION_SECRET: "phase-d1-command-center-admin-secret-32-chars",
      VIBE_JUDGE_SESSION_SECRET: "phase-d1-command-center-judge-secret-32-chars",
      VIBE_NATIVE_TEAM_CHAT_ENABLED: "false",
      VIBE_ADMIN_COOKIE_SECURE: "true",
      VIBE_JUDGE_EVENT_ID: "evt_vibe_2025",
    },
  },
});
