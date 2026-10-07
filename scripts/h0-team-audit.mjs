import { chromium } from "playwright";
import fs from "fs";

const base = process.env.H0_BASE_URL || "https://localhost:3270";
const shot = process.env.H0_SCREENSHOT_DIR || "docs/participants/screenshots/h0";
const personas = JSON.parse(fs.readFileSync(process.env.H0_CREDENTIALS, "utf8")).personas;
const owner = personas.find((item) => item.userId === "kv_user_0001");
const teammate = personas.find((item) => item.userId === "kv_user_0011");
const other = personas.find((item) => item.userId === "kv_user_0002");
const browser = await chromium.launch({ headless: true });
const desktop = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 1000 } });
const page = await desktop.newPage();
const rows = [];
async function go(path, label) { const started = Date.now(); await page.goto(`${base}${path}`, { waitUntil: "domcontentloaded" }); await page.waitForLoadState("networkidle").catch(() => {}); rows.push({ label, path: new URL(page.url()).pathname, ms: Date.now() - started, heading: (await page.locator("h1").first().textContent().catch(() => ""))?.trim() || "" }); }
async function shotPage(name) { await page.screenshot({ path: `${shot}/${name}.png`, fullPage: false }); }
async function login(user, returnTo) { await go(`/login?returnTo=${encodeURIComponent(returnTo)}`, "login"); await page.getByLabel("Email", { exact: true }).fill(user.email); await page.getByLabel("Password", { exact: true }).fill(user.password); await page.getByRole("button", { name: "Sign in", exact: true }).click(); await page.waitForTimeout(800); }
await login(owner, "/projects/kv_submission_0001/team");
await go("/projects/kv_submission_0001/team", "team");
await shotPage("h0-desktop-team");
const headings = await page.locator("h1,h2").allTextContents();
const labels = await page.locator(".badge").allTextContents();
const inviteButton = page.getByRole("button", { name: "Invite teammate", exact: true });
let invitationPath = "";
if (await inviteButton.count()) {
  await inviteButton.click();
  const dialog = page.getByRole("dialog");
  rows.push({ label: "invite-dialog", path: new URL(page.url()).pathname, focusRole: await page.evaluate(() => document.activeElement?.getAttribute("role")), dialog: (await dialog.textContent().catch(() => ""))?.replace(/https?:\/\/\S+/g, "[private-link]").slice(0, 320) });
  await shotPage("h0-desktop-invitation");
  const create = page.getByRole("button", { name: "Create invitation link", exact: true });
  if (await create.count()) {
    await create.click();
    await page.getByText("Invitation link ready", { exact: true }).waitFor({ timeout: 10000 });
    await shotPage("h0-desktop-invitation-ready");
    invitationPath = await page.locator("details input").getAttribute("value");
    rows.push({ label: "invitation-created", path: "/projects/join/[private-token]", privateLinkCaptured: Boolean(invitationPath) });
  }
}
// Team Chat and workspace return path are safe read-only views for the owner.
await go("/projects/kv_submission_0001/messages", "team-chat");
await shotPage("h0-desktop-team-chat");
// Wrong-account warning uses the private link only in memory and is not retained.
if (invitationPath) {
  const wrong = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 1000 } });
  const wrongPage = await wrong.newPage();
  await wrongPage.goto(invitationPath, { waitUntil: "domcontentloaded" });
  await wrongPage.getByRole("link", { name: /Sign in to continue/i }).click();
  await wrongPage.waitForURL(/\/login/);
  await wrongPage.getByLabel("Email", { exact: true }).fill(other.email);
  await wrongPage.getByLabel("Password", { exact: true }).fill(other.password);
  await wrongPage.getByRole("button", { name: "Sign in", exact: true }).click();
  await wrongPage.waitForTimeout(600);
  await wrongPage.goto(`${base}/projects/join`, { waitUntil: "domcontentloaded" });
  rows.push({ label: "wrong-account-bridge", path: new URL(wrongPage.url()).pathname, heading: (await wrongPage.locator("h1").first().textContent().catch(() => ""))?.trim() || "", hasIdentityCopy: await wrongPage.getByText(/Joining adds project access to this account/i).count() > 0 });
  await wrongPage.screenshot({ path: `${shot}/h0-desktop-wrong-account.png`, fullPage: false });
  await wrong.close();
}
// Mobile team surface and empty-state pages.
const mobile = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 390, height: 844 } });
const mobilePage = await mobile.newPage();
await mobilePage.goto(`${base}/login?returnTo=${encodeURIComponent("/projects/kv_submission_0001/team")}`, { waitUntil: "domcontentloaded" });
await mobilePage.getByLabel("Email", { exact: true }).fill(teammate.email);
await mobilePage.getByLabel("Password", { exact: true }).fill(teammate.password);
await mobilePage.getByRole("button", { name: "Sign in", exact: true }).click();
await mobilePage.waitForTimeout(600);
await mobilePage.goto(`${base}/projects/kv_submission_0001/team`, { waitUntil: "domcontentloaded" });
await mobilePage.screenshot({ path: `${shot}/h0-mobile-team.png`, fullPage: false });
const overflow = await mobilePage.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
rows.push({ label: "mobile-team", path: new URL(mobilePage.url()).pathname, overflow, heading: (await mobilePage.locator("h1").first().textContent().catch(() => ""))?.trim() || "" });
console.log(JSON.stringify({ rows, headings, labels: labels.map((item) => item.trim()).filter(Boolean) }, null, 2));
await browser.close();
