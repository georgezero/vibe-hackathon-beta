import { defineConfig, devices } from "@playwright/test";

const port = 3270;
const targetPort = 3271;
const databaseFile = "/tmp/vibe-hackathon-d2-results.db";
process.env.PLAYWRIGHT_D2_DB_FILE = databaseFile;

export default defineConfig({
  testDir: "./tests/playwright",
  testMatch: "**/results-d2.spec.ts",
  timeout: 45_000,
  workers: 1,
  fullyParallel: false,
  use: { baseURL: `https://localhost:${port}`, ignoreHTTPSErrors: true, trace: "on-first-retry" },
  projects: [{ name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } }, { name: "mobile-chromium", use: { ...devices["Pixel 7"] } }],
  webServer: {
    command: `rm -f ${databaseFile} ${databaseFile}-shm ${databaseFile}-wal /tmp/d2-localhost-key.pem /tmp/d2-localhost-cert.pem && DB_FILE_NAME=${databaseFile} npm run db:push && openssl req -x509 -newkey rsa:2048 -nodes -keyout /tmp/d2-localhost-key.pem -out /tmp/d2-localhost-cert.pem -days 1 -subj '/CN=localhost' -addext 'subjectAltName=DNS:localhost' >/tmp/d2-openssl.log 2>&1 && chmod 600 /tmp/d2-localhost-key.pem && (npm start -- -p ${targetPort} & next_pid=$!; D1_HTTPS_PORT=${port} D1_TARGET_PORT=${targetPort} D1_KEY=/tmp/d2-localhost-key.pem D1_CERT=/tmp/d2-localhost-cert.pem node scripts/c6-https-proxy.mjs; kill $next_pid; rm -f /tmp/d2-localhost-key.pem /tmp/d2-localhost-cert.pem /tmp/d2-openssl.log)`,
    url: `http://localhost:${targetPort}`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { NODE_ENV: "test", BETTER_AUTH_SECRET: "phase-d2-results-better-auth-secret-32-chars", BETTER_AUTH_URL: `https://localhost:${port}`, VIBE_HACKATHON_BASE_URL: `https://localhost:${port}`, DB_FILE_NAME: databaseFile, VIBE_TEST_DATABASE_ROOT: "/tmp", VIBY_BASE_URL: "http://localhost:3272", VIBY_APP_SLUG: "vibe-hackathon", VIBY_CALLBACK_STATE_SECRET: "phase-d2-results-callback-secret-32-chars", VIBE_ADMIN_SESSION_SECRET: "phase-d2-results-admin-secret-32-chars", VIBE_JUDGE_SESSION_SECRET: "phase-d2-results-judge-secret-32-chars", VIBE_ADMIN_COOKIE_SECURE: "true" },
  },
});
