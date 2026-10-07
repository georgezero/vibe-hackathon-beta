import { parseGithubUrl, fetchRepoFiles } from "./github-fetch";
import { scoreSubmission, type ScoringDetails } from "./repo-scorer";
import { db } from "./db";
import { submissions, aiReviews, aiEvaluationTokens } from "./db/schema";
import { eq } from "drizzle-orm";
import { getActiveEvent } from "./events";
import { getBaseUrl } from "./base-url";
import { nanoid } from "nanoid";
import { resolveScreenshotUrls } from "./screenshots";

// ── Evaluation token ──────────────────────────────────────────────────────────

export async function getOrCreateEvalToken(submissionId: string, createdBy = "admin"): Promise<string> {
  const rows = await db
    .select()
    .from(aiEvaluationTokens)
    .where(eq(aiEvaluationTokens.submissionId, submissionId));

  // Return first non-expired token
  const now = new Date();
  const valid = rows.find((r: typeof rows[number]) => !r.expiresAt || r.expiresAt > now);
  if (valid) return valid.token;

  // Create new token
  const token = `eval_${nanoid(20)}`;
  await db.insert(aiEvaluationTokens).values({
    id: `aet_${nanoid(8)}`,
    submissionId,
    token,
    createdBy,
    createdAt: now,
  });
  return token;
}

export async function validateEvalToken(submissionId: string, token: string): Promise<boolean> {
  const rows = await db
    .select()
    .from(aiEvaluationTokens)
    .where(eq(aiEvaluationTokens.token, token));

  const row = rows[0];
  if (!row) return false;
  if (row.token !== token) return false;
  if (row.submissionId !== submissionId) return false;
  if (row.expiresAt && row.expiresAt < new Date()) return false;

  return true;
}

export async function markEvalTokenUsed(token: string): Promise<void> {
  await db
    .update(aiEvaluationTokens)
    .set({ lastUsedAt: new Date() })
    .where(eq(aiEvaluationTokens.token, token));
}

// ── Packet type ───────────────────────────────────────────────────────────────

export interface JudgePacket {
  schema: "vibe-ai-judge-packet-v1";
  base_url: string;
  generated_at: string;
  event: { id: string; name: string; displayName: string | null };
  submission: {
    id: string;
    teamName: string;
    projectTitle: string | null;
    problemStatement: string | null;
    targetUsers: string | null;
    githubUrl: string | null;
    demoUrl: string | null;
    demoVideoUrl: string | null;
    screenshotUrl: string | null;
    screenshotUrls: string[];
    budgetTier: string | null;
    estimatedHumanHours: number | null;
    estimatedAgentHours: number | null;
    agentModels: string[] | null;
    agentHarnesses: string[] | null;
    license: string | null;
    tags: string[] | null;
    status: string;
    submittedAt: string | null;
    updatedAt: string | null;
  };
  repo_files: {
    readme: string | null;
    agents_md: string | null;
    vibe_json: string | null;
    vibe_submission_md: string | null;
    agent_report_md: string | null;
    prompts_md: string | null;
    branch: string | null;
    fetch_error: string | null;
  };
  deterministic_review: ScoringDetails | null;
  rubric: typeof RUBRIC;
}

export const RUBRIC = {
  description:
    "Score each dimension 0–100. overall_score is your holistic judgment — not necessarily the mean.",
  dimensions: {
    product_sense_score: "Problem selection quality, identifiable real user, non-trivial scoping",
    originality_score: "Novelty of approach, domain insight, non-tutorial framing",
    execution_score: "Reliability, reproducibility, working demo, code quality",
    ai_collaboration_score:
      "Evidence of intentional human direction of AI agents — workflows, prompts, decomposition",
    usefulness_score: "Would domain professionals actually use this in their workflow?",
    presentation_score: "Documentation quality, clarity of judge-facing artifacts",
  },
  anti_patterns: [
    "Superficial demos that solve no real problem",
    "Unsupported claims — treat all self-reported hours/costs as unverified",
    "Generic CRUD + LLM with no domain insight",
    "Submission not reproducible by a stranger",
    "AGENTS.md missing or too thin",
    "AI contribution indistinguishable from basic autocomplete",
  ],
  output_schema: {
    product_sense_score: "integer 0–100",
    originality_score: "integer 0–100",
    execution_score: "integer 0–100",
    ai_collaboration_score: "integer 0–100",
    usefulness_score: "integer 0–100",
    presentation_score: "integer 0–100",
    overall_score: "integer 0–100",
    risk_flags: "string[]",
    rationale: "string — 2–4 sentence holistic summary",
    suggested_human_questions: "string[] — 2–4 questions for live presentation",
  },
} as const;

// ── Packet builder ────────────────────────────────────────────────────────────

export async function buildJudgePacket(submissionId: string): Promise<JudgePacket | null> {
  const subRows = await db.select().from(submissions).where(eq(submissions.id, submissionId));
  const sub = subRows[0];
  if (!sub) return null;

  const activeEvent = await getActiveEvent();

  const baseUrl = getBaseUrl();

  const repoFiles: JudgePacket["repo_files"] = {
    readme: null,
    agents_md: null,
    vibe_json: null,
    vibe_submission_md: null,
    agent_report_md: null,
    prompts_md: null,
    branch: null,
    fetch_error: null,
  };

  let deterministicReview: ScoringDetails | null = null;

  if (sub.githubUrl) {
    const coords = parseGithubUrl(sub.githubUrl);
    if (coords) {
      try {
        const files = await fetchRepoFiles(coords);
        repoFiles.readme = files.readme?.content ?? null;
        repoFiles.agents_md = files.agentsMd?.content ?? null;
        repoFiles.vibe_json = files.vibeJson?.content ?? null;
        repoFiles.vibe_submission_md = files.vibeSubmissionMd?.content ?? null;
        repoFiles.agent_report_md = files.agentReportMd?.content ?? null;
        repoFiles.prompts_md = files.promptsMd?.content ?? null;
        repoFiles.branch = files.branch ?? null;
        deterministicReview = scoreSubmission(files);
      } catch (err) {
        repoFiles.fetch_error = err instanceof Error ? err.message : String(err);
      }
    } else {
      repoFiles.fetch_error = "Could not parse GitHub URL";
    }
  }

  // Fall back to stored deterministic score
  if (!deterministicReview) {
    const reviewRows = await db.select().from(aiReviews).where(eq(aiReviews.submissionId, submissionId));
    if (reviewRows[0]?.scoringDetails) {
      deterministicReview = reviewRows[0].scoringDetails as ScoringDetails;
    }
  }

  return {
    schema: "vibe-ai-judge-packet-v1",
    base_url: baseUrl,
    generated_at: new Date().toISOString(),
    event: {
      id: activeEvent.id,
      name: activeEvent.name,
      displayName: activeEvent.displayName ?? null,
    },
    submission: {
      id: sub.id,
      teamName: sub.teamName,
      projectTitle: sub.projectTitle ?? null,
      problemStatement: sub.problemStatement ?? null,
      targetUsers: sub.targetUsers ?? null,
      githubUrl: sub.githubUrl ?? null,
      demoUrl: sub.demoUrl ?? null,
      demoVideoUrl: sub.demoVideoUrl ?? null,
      screenshotUrl: sub.screenshotUrl ?? null,
      screenshotUrls: resolveScreenshotUrls(sub),
      budgetTier: sub.budgetTier ?? null,
      estimatedHumanHours: sub.estimatedHumanHours ?? null,
      estimatedAgentHours: sub.estimatedAgentHours ?? null,
      agentModels: sub.agentModels as string[] | null,
      agentHarnesses: sub.agentHarnesses as string[] | null,
      license: sub.license ?? null,
      tags: sub.tags as string[] | null,
      status: sub.status,
      submittedAt: sub.submittedAt?.toISOString() ?? null,
      updatedAt: sub.finalizedAt?.toISOString() ?? sub.submittedAt?.toISOString() ?? null,
    },
    repo_files: repoFiles,
    deterministic_review: deterministicReview,
    rubric: RUBRIC,
  };
}

// ── Prompt builder ────────────────────────────────────────────────────────────

export function packetToPrompt(packet: JudgePacket): string {
  const { submission, repo_files, deterministic_review, rubric } = packet;
  const parts: string[] = [];

  parts.push(`# Vibe Hackathon — AI Judge Evaluation

**Submission ID:** \`${submission.id}\`

---

## Instructions

You are evaluating a submission for a Vibe Hackathon — a competition where teams use AI coding agents to build working applications for domain professionals.

**Critical rules:**
- Return ONLY a valid JSON object. No prose. No markdown fences.
- Score only from the evidence in this prompt.
- Do not invent information not present in the submission.
- All self-reported fields (hours, costs, tokens) are **unverified** — treat as context, not proof.

---

## Submission

- **Project**: ${submission.projectTitle ?? "Untitled"}
- **Team**: ${submission.teamName}
- **GitHub**: ${submission.githubUrl ?? "not provided"}
- **Demo URL**: ${submission.demoUrl ?? "not provided"}
- **Budget tier**: ${submission.budgetTier ?? "not reported"} _(self-reported)_
- **Agent harnesses**: ${submission.agentHarnesses?.join(", ") ?? "not reported"}
- **Models used**: ${submission.agentModels?.join(", ") ?? "not reported"}
- **Estimated human hours**: ${submission.estimatedHumanHours ?? "not reported"} _(self-reported)_
- **Estimated agent hours**: ${submission.estimatedAgentHours ?? "not reported"} _(self-reported)_
- **License**: ${submission.license ?? "not reported"}`);

  if (submission.problemStatement) {
    parts.push(`## Problem Statement\n\n${submission.problemStatement}`);
  }

  if (deterministic_review) {
    const d = deterministic_review;
    parts.push(`## Deterministic Repo Scores (pre-computed — do not re-score these)

- Repo structure: ${d.repo_score}/100
- Documentation: ${d.documentation_score}/100
- Reproducibility: ${d.reproducibility_score}/100
- Deployment: ${d.deployment_score}/100
- Agent readiness: ${d.agent_readiness_score}/100
- Warnings: ${d.warnings.join("; ") || "none"}`);
  }

  const addFile = (label: string, content: string | null, maxChars: number) => {
    if (!content) return;
    const truncated = content.length > maxChars;
    parts.push(`## ${label}${truncated ? ` (truncated — ${maxChars} chars shown)` : ""}\n\n${content.slice(0, maxChars)}`);
  };

  addFile("README.md", repo_files.readme, 4000);
  addFile("AGENTS.md", repo_files.agents_md, 3000);
  addFile("docs/vibe-submission.md", repo_files.vibe_submission_md, 2500);
  addFile("docs/agent-report.md", repo_files.agent_report_md, 2000);
  addFile("docs/prompts.md", repo_files.prompts_md, 1500);

  if (repo_files.fetch_error) {
    parts.push(`## Repo Access Note\n\nRepository files could not be fetched: ${repo_files.fetch_error}.\nScore execution and reproducibility conservatively — no repo content was available.`);
  }

  parts.push(`## Scoring Rubric

${rubric.description}

**Dimensions (score each 0–100):**
${Object.entries(rubric.dimensions).map(([k, v]) => `- \`${k}\`: ${v}`).join("\n")}

**Anti-patterns to penalize:**
${rubric.anti_patterns.map((p) => `- ${p}`).join("\n")}

## Required Output

Return ONLY this JSON. No prose. No markdown fences.

{
  "product_sense_score": <integer 0-100>,
  "originality_score": <integer 0-100>,
  "execution_score": <integer 0-100>,
  "ai_collaboration_score": <integer 0-100>,
  "usefulness_score": <integer 0-100>,
  "presentation_score": <integer 0-100>,
  "overall_score": <integer 0-100>,
  "risk_flags": ["<string>", ...],
  "rationale": "<2-4 sentence holistic summary>",
  "suggested_human_questions": ["<question>", ...]
}`);

  return parts.join("\n\n---\n\n");
}
