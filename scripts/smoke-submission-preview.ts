#!/usr/bin/env tsx

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { aiReviews } from "@/lib/db/schema";

const baseUrl = (
  process.env.VIBE_SMOKE_BASE_URL ??
  process.env.VIBE_HACKATHON_BASE_URL ??
  "http://localhost:3000"
).replace(/\/+$/, "");

const githubUrl = process.env.VIBE_SMOKE_GITHUB_URL ?? "https://github.com/vercel/next.js";
const runId = Math.random().toString(36).slice(2, 8);
const title = `Smoke Preview ${runId}`;
const teamName = `Smoke Team ${runId}`;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function json(path: string, init?: RequestInit) {
  const res = await fetch(`${baseUrl}${path}`, init);
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new Error(`${init?.method ?? "GET"} ${path} failed (${res.status}): ${text}`);
  }
  return data;
}

async function html(pathOrUrl: string) {
  const url = pathOrUrl.startsWith("http") ? pathOrUrl : `${baseUrl}${pathOrUrl}`;
  const res = await fetch(url);
  const text = await res.text();
  if (!res.ok) throw new Error(`GET ${url} failed (${res.status}): ${text.slice(0, 300)}`);
  return text;
}

async function main() {
  console.log(`Smoke base URL: ${baseUrl}`);

  console.log("1. Create draft from web API");
  const created = await json("/api/v1/submissions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      teamName,
      contactEmail: `smoke-${runId}@example.com`,
    }),
  });

  const id = String(created.submission_id ?? created.id);
  const token = String(created.editToken);
  assert(id && token, "Create response missing submission ID or editToken");
  assert(created.preview_url, "Create response missing preview_url");

  await json(`/api/v1/submissions/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      projectTitle: title,
      problemStatement: "Smoke test draft for the private submission preview flow and public visibility gate.",
      targetUsers: "Organizers verifying preview before feature freeze.",
      demoUrl: "https://example.com/demo",
      demoVideoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      githubUrl,
      screenshotUrls: ["https://picsum.photos/seed/vibe-smoke-preview/1200/675"],
      readmeUrl: `${githubUrl.replace(/\/$/, "")}/blob/canary/README.md`,
      agentsMdUrl: `${githubUrl.replace(/\/$/, "")}/blob/canary/AGENTS.md`,
      sampleDataDescription: "Smoke test sample data notes for readiness checklist.",
      setupInstructions: "Install dependencies and run the app locally.",
      license: "MIT",
      tags: ["smoke-test"],
      agentHarnesses: ["Codex CLI"],
      agentModels: ["gpt-5-codex"],
      budgetTier: "unknown",
    }),
  });

  console.log("2. Open preview");
  const preview = await html(String(created.preview_url));
  assert(preview.includes(title), "Preview page did not include project title");
  assert(preview.includes("Copy Revision Prompt"), "Preview page did not render Copy Revision Prompt button");

  console.log("3. Confirm draft does NOT appear on /projects");
  const projectsBefore = await html("/projects");
  assert(!projectsBefore.includes(title), "Draft appeared on /projects before finalization");

  console.log("4. Confirm Copy Revision Prompt is available");
  assert(preview.includes("Copy Revision Prompt"), "Copy Revision Prompt button missing from preview");

  console.log("5. Finalize from preview-equivalent endpoint");
  await json(`/api/v1/submissions/${id}/finalize`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ source: "smoke-submission-preview" }),
  });

  console.log("6. Confirm project appears on /projects");
  const projectsAfter = await html("/projects");
  assert(projectsAfter.includes(title), "Finalized submission did not appear on /projects");

  console.log("7. Confirm deterministic AI review runs");
  const reviewRows = await db.select().from(aiReviews).where(eq(aiReviews.submissionId, id));
  assert(reviewRows.length > 0, "No deterministic AI review row was created");
  assert(reviewRows[0].status === "complete", `AI review status was ${reviewRows[0].status}, expected complete`);

  console.log(`Smoke passed: ${title} (${id})`);
}

main().catch((err) => {
  console.error("Smoke failed:");
  console.error(err);
  process.exit(1);
});
