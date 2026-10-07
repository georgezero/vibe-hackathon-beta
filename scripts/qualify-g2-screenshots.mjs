import fs from "node:fs";
import { chromium } from "@playwright/test";

const base = "https://kentucky-vibes-f0b.ggg.ad";
const email = "f0b-participant-2@kentucky-vibes.example.invalid";
const password = fs.readFileSync("/opt/vibe-hackathon/instances/kentucky-vibes-f0b-test-20260808T224500Z/credentials/participant2.password", "utf8").trim();

async function signIn(page) {
  await page.goto(`${base}/login?returnTo=%2Faccount%2Fprojects`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/account\/projects/);
}

const browser = await chromium.launch();
try {
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await signIn(desktop);
  await desktop.goto(`${base}/projects/kv_submission_0072/messages`);
  await desktop.screenshot({ path: "docs/participants/screenshots/g2/11-team-chat-return-desktop.png", fullPage: true });
  await desktop.close();

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
  await signIn(mobile);
  const cards = mobile.locator(".project-card");
  await cards.nth(0).screenshot({ path: "docs/participants/screenshots/g2/13-attention-card-mobile.png" });
  await cards.nth(2).screenshot({ path: "docs/participants/screenshots/g2/14-ready-card-mobile.png" });
  await mobile.goto(`${base}/projects/kv_submission_0072`);
  await mobile.screenshot({ path: "docs/participants/screenshots/g2/15-project-workspace-mobile.png", fullPage: true });
  console.log("G2 screenshots captured", mobile.url());
} finally {
  await browser.close();
}
