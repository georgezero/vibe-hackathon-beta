import { chromium } from "playwright";
import Database from "better-sqlite3";
import fs from "fs";

const base = process.env.H0_BASE_URL || "https://localhost:3270";
const shot = process.env.H0_SCREENSHOT_DIR || "docs/participants/screenshots/h0";
const personas = JSON.parse(fs.readFileSync(process.env.H0_CREDENTIALS, "utf8")).personas;
const owner = personas.find((item) => item.userId === "kv_user_0001");
const db = new Database(process.env.H0_DB);
const guest = db.prepare("select edit_token as token from submissions where team_name=? order by created_at desc limit 1").get("H0 Solo Journey");
db.close();
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 390, height: 844 } });
const page = await context.newPage();
const rows = [];
async function go(path, label, name) { const t = Date.now(); await page.goto(`${base}${path}`, { waitUntil: "domcontentloaded" }); await page.waitForLoadState("networkidle").catch(() => {}); await page.screenshot({ path: `${shot}/${name}.png`, fullPage: false }); rows.push({ label, path: new URL(page.url()).pathname, ms: Date.now() - t, heading: (await page.locator("h1").first().textContent().catch(() => ""))?.trim() || "", overflow: await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth) }); }
await go("/", "landing", "h0-mobile-landing");
await go("/start", "start", "h0-mobile-start");
if (guest?.token) {
  await go(`/submit/${encodeURIComponent(guest.token)}/start`, "project handoff", "h0-mobile-project-handoff");
  await go(`/submit/${encodeURIComponent(guest.token)}`, "editor", "h0-mobile-editor");
  await go(`/submit/${encodeURIComponent(guest.token)}/preview`, "preview", "h0-mobile-preview");
  await go(`/submit/${encodeURIComponent(guest.token)}/done`, "receipt", "h0-mobile-receipt");
}
await page.goto(`${base}/login?returnTo=%2Fmessages`, { waitUntil: "domcontentloaded" });
await page.getByLabel("Email", { exact: true }).fill(owner.email);
await page.getByLabel("Password", { exact: true }).fill(owner.password);
await page.getByRole("button", { name: "Sign in", exact: true }).click();
await page.waitForTimeout(600);
for (const [path, name] of [["/projects/kv_submission_0001/messages", "h0-mobile-team-chat"], ["/messages", "h0-mobile-messages"], ["/community", "h0-mobile-community"]]) await go(path, name, name);
console.log(JSON.stringify(rows, null, 2));
await browser.close();
