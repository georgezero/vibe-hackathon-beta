import { defineConfig, devices } from "@playwright/test";

const port = 3240;
const targetPort = 3241;
const origin = `https://localhost:${port}`;
const databaseFile = "/tmp/vibe-hackathon-c3-playwright.db";
process.env.PLAYWRIGHT_C3_DB_FILE = databaseFile;

export default defineConfig({
  testDir: "./tests/playwright",
  testMatch: "**/native-chat.spec.ts",
  timeout: 45_000,
  workers: 1,
  fullyParallel: false,
  use: { baseURL: origin, ignoreHTTPSErrors: true, trace: "on-first-retry" },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `rm -f ${databaseFile} ${databaseFile}-shm ${databaseFile}-wal /tmp/c6-localhost-key.pem /tmp/c6-localhost-cert.pem && DB_FILE_NAME=${databaseFile} npm run db:push && openssl req -x509 -newkey rsa:2048 -nodes -keyout /tmp/c6-localhost-key.pem -out /tmp/c6-localhost-cert.pem -days 1 -subj '/CN=localhost' -addext 'subjectAltName=DNS:localhost' >/tmp/c6-openssl.log 2>&1 && chmod 600 /tmp/c6-localhost-key.pem && (npm start -- -p ${targetPort} & next_pid=$!; node scripts/c6-https-proxy.mjs; kill $next_pid; rm -f /tmp/c6-localhost-key.pem /tmp/c6-localhost-cert.pem /tmp/c6-openssl.log)`,
    url: `http://localhost:${targetPort}`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      NODE_ENV: "test",
      BETTER_AUTH_SECRET: "phase-c3-native-chat-better-auth-secret-32-chars",
      BETTER_AUTH_URL: origin,
      VIBE_HACKATHON_BASE_URL: origin,
      DB_FILE_NAME: databaseFile,
      VIBE_TEST_DATABASE_ROOT: "/tmp",
      VIBY_BASE_URL: "http://localhost:3241",
      VIBY_APP_SLUG: "vibe-hackathon",
      VIBY_CLIENT_SECRET: "phase-c3-native-chat-viby-client-secret",
      VIBY_CALLBACK_STATE_SECRET: "phase-c3-native-chat-callback-secret-32-chars",
      VIBE_VIBY_SESSION_MODE: "better-auth",
      VIBE_NATIVE_TEAM_CHAT_ENABLED: "true",
      VIBE_ADMIN_COOKIE_SECURE: "false",
    },
  },
});
