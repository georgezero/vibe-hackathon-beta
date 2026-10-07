import { chromium } from "playwright";
import fs from "fs";

const base = process.env.H0_BASE_URL || "https://localhost:3270";
const shot = process.env.H0_SCREENSHOT_DIR || "docs/participants/screenshots/h0";
const credentialsPath = process.env.H0_CREDENTIALS;
const personas = JSON.parse(fs.readFileSync(credentialsPath, "utf8")).personas;
const owner = personas.find((item) => item.userId === "kv_user_0001");
const teammate = personas.find((item) => item.userId === "kv_user_0011");
const other = personas.find((item) => item.userId === "kv_user_0002");
const journey = [];
const trace = [];
function log(message) { trace.push(message); console.log(`[h0] ${message}`); }
process.on("uncaughtException", (error) => { console.error("[h0] uncaught", error); process.exitCode = 1; });
process.on("unhandledRejection", (error) => { console.error("[h0] unhandled", error); process.exitCode = 1; });

function cleanPath(value) {
  return value.replace(base, "").replace(/\?.*$/, "");
}

async function screenshot(page, name) {
  await page.screenshot({ path: `${shot}/${name}.png`, fullPage: false });
}

async function navigate(page, path, label) {
  log(`navigate ${label} ${path}`);
  const started = Date.now();
  await page.goto(path.startsWith("http") ? path : `${base}${path}`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});
  const heading = (await page.locator("h1").first().textContent().catch(() => ""))?.trim() || "";
  journey.push({ label, path: cleanPath(page.url()), ms: Date.now() - started, heading });
  log(`loaded ${label} ${heading}`);
}

async function signIn(page, user, returnTo = "/account/projects") {
  await navigate(page, `/login?returnTo=${encodeURIComponent(returnTo)}`, "login");
  await page.getByLabel("Email", { exact: true }).fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(/account\/projects|projects\/join|claim\/confirm/, { timeout: 15000 });
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
page.on("response", async (response) => {
  if (response.url().includes("/api/register-team")) {
    log(`register response ${response.status()}`);
  }
});

log("browser started");
await navigate(page, "/", "landing");
await screenshot(page, "h0-desktop-landing");
await navigate(page, "/start", "start");
await screenshot(page, "h0-desktop-start");
log(`team labels ${await page.getByLabel("Team name").count()} lead labels ${await page.getByLabel("Name *", { exact: true }).count()}`);
await page.getByLabel("Team name").fill("H0 Solo Journey");
log("team filled");
await page.getByLabel("Name *", { exact: true }).fill("H0 Solo Lead");
log("lead filled");
log(`start labels ${(await page.locator("label").allTextContents()).map((item) => item.trim()).filter(Boolean).join(" | ")}`);
await page.locator("#contact-email").fill("h0-solo-lead@example.invalid");
await page.locator("#owner-badge-number").fill("H0-OWNER-0001");
await page.getByRole("button", { name: /Create project/i }).click();
log("create clicked");
await page.waitForTimeout(1500);
log(`after create ${page.url()} invalid ${(await page.locator(":invalid").evaluateAll((els) => els.map((el) => ({ id: el.id, name: el.getAttribute("name"), value: el.value }))))} alerts ${(await page.locator('[role="alert"]').allTextContents()).join(" | ")}`);
await page.getByRole("heading", { name: "Your project is ready" }).waitFor({ timeout: 10000 });
const startPath = new URL(await page.getByRole("link", { name: /Continue without an account/i }).getAttribute("href"), base).pathname;
log(`created ${startPath}`);
await screenshot(page, "h0-desktop-project-created");
await navigate(page, startPath, "project-handoff");
await screenshot(page, "h0-desktop-project-handoff");
const editorHref = (await page.locator("a").evaluateAll((anchors) => anchors.map((anchor) => ({ href: anchor.getAttribute("href"), text: anchor.textContent?.trim() })).find((item) => item.text === "Open project form")?.href)) || "";
log(`editor href ${editorHref ? "present" : "missing"}`);
await navigate(page, editorHref, "editor");
log("editor opened");
await screenshot(page, "h0-desktop-editor");

const fields = {
  "field-projectTitle": "H0 Workflow Story",
  "field-problemStatement": "Clinical teams lose time moving context between disconnected workflow tools during urgent review.",
  "field-demoUrl": "https://demo.example.invalid/h0-workflow",
  "field-githubUrl": "https://github.com/example/h0-workflow",
  "field-agentsMdUrl": "https://example.invalid/h0/AGENTS.md",
  "field-license": "MIT",
  "field-screenshotUrls-0": "https://example.invalid/h0-workflow.png",
  "field-sampleDataDescription": "Synthetic de-identified sample data created for this qualification journey.",
};
for (const [id, value] of Object.entries(fields)) {
  const field = page.locator(`#${id}`);
  if (await field.count()) await field.fill(value);
}
await page.getByRole("button", { name: "Save", exact: true }).first().click();
log("save clicked");
await page.getByText("Saved", { exact: true }).first().waitFor({ timeout: 10000 }).catch(() => {});
await screenshot(page, "h0-desktop-editor-complete");
const previewHref = await page.getByRole("link", { name: /Review judge-facing preview/i }).getAttribute("href");
await navigate(page, previewHref, "preview");
log("preview opened");
await screenshot(page, "h0-desktop-preview");
const submitButton = page.getByRole("button", { name: /Submit for judging/i }).first();
if (await submitButton.count()) {
  await submitButton.click();
  await page.getByRole("button", { name: /Submit for judging/i }).last().click();
  await page.waitForURL(/\/submit\/[^/]+\/done/, { timeout: 15000 });
  log("submitted");
  await screenshot(page, "h0-desktop-receipt");
}

const accountPage = await context.newPage();
await signIn(accountPage, owner);
await navigate(accountPage, "/account/projects", "my-projects");
await screenshot(accountPage, "h0-desktop-my-projects");
for (const [path, name] of [["/people", "h0-desktop-people"], ["/messages", "h0-desktop-messages"], ["/community", "h0-desktop-community"]]) {
  await navigate(accountPage, path, name);
  await screenshot(accountPage, name);
}

console.log(JSON.stringify({ journey, trace, startPath, identities: { owner: owner.email, teammate: teammate.email, other: other.email } }, null, 2));
await browser.close();
