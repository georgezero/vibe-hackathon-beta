import type { RepoFiles } from "./github-fetch";
import type { ScoringDetails } from "./repo-scorer";

export interface LLMJudgeInput {
  submissionId: string;
  submission: {
    projectTitle: string | null;
    problemStatement: string | null;
    teamName: string;
    githubUrl: string | null;
    demoUrl: string | null;
    budgetTier: string | null;
    estimatedHumanHours: number | null;
    estimatedAgentHours: number | null;
    agentModels: string[] | null;
    agentHarnesses: string[] | null;
    license: string | null;
  };
  files: RepoFiles | null;
  deterministicScore: ScoringDetails | null;
}

export interface LLMJudgeScores {
  product_sense_score: number;
  originality_score: number;
  execution_score: number;
  ai_collaboration_score: number;
  usefulness_score: number;
  presentation_score: number;
  overall_score: number;
  risk_flags: string[];
  rationale: string;
  suggested_human_questions: string[];
}

// ── Mock mode ─────────────────────────────────────────────────────────────────

function hashSeed(s: string): number {
  let h = 0x9abc_ef01;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 2654435761);
    h ^= h >>> 17;
  }
  return Math.abs(h);
}

function mockScore(seed: string, dimension: string, min = 48, max = 91): number {
  return min + (hashSeed(seed + ":" + dimension) % (max - min + 1));
}

function runMockJudge(input: LLMJudgeInput): LLMJudgeScores {
  const seed = input.submissionId;
  const title = input.submission.projectTitle ?? input.submission.teamName;

  const product_sense_score = mockScore(seed, "product_sense", 50, 90);
  const originality_score = mockScore(seed, "originality", 42, 88);
  const execution_score = mockScore(seed, "execution", 52, 94);
  const ai_collaboration_score = mockScore(seed, "ai_collab", 55, 93);
  const usefulness_score = mockScore(seed, "usefulness", 45, 89);
  const presentation_score = mockScore(seed, "presentation", 48, 92);
  const overall_score = Math.round(
    (product_sense_score + originality_score + execution_score +
     ai_collaboration_score + usefulness_score + presentation_score) / 6
  );

  const risk_flags: string[] = [];
  if (!input.submission.githubUrl) risk_flags.push("No GitHub URL provided");
  if (!input.submission.demoUrl) risk_flags.push("No demo URL provided");
  if (input.deterministicScore && input.deterministicScore.repo_score < 50) {
    risk_flags.push("Low repo score — missing required files");
  }
  if (!input.submission.estimatedAgentHours) {
    risk_flags.push("Agent hours not reported — AI collaboration depth unverifiable");
  }

  const quality = overall_score >= 75 ? "strong" : overall_score >= 60 ? "solid" : "developing";

  return {
    product_sense_score,
    originality_score,
    execution_score,
    ai_collaboration_score,
    usefulness_score,
    presentation_score,
    overall_score,
    risk_flags,
    rationale: `[MOCK] "${title}" demonstrates ${quality} overall execution (${overall_score}/100). ` +
      `Product sense: ${product_sense_score}/100. AI collaboration evidence: ${ai_collaboration_score}/100. ` +
      `Execution quality: ${execution_score}/100. ` +
      `This is a deterministic mock evaluation for UI testing — no LLM was called.`,
    suggested_human_questions: [
      "Which parts of the problem did you delegate to AI agents, and why?",
      "What was the biggest reproducibility challenge in your demo?",
      "Walk us through the most interesting agent workflow in your project.",
    ],
  };
}

// ── Real LLM paths ────────────────────────────────────────────────────────────

function buildJudgePrompt(input: LLMJudgeInput): string {
  const { submission, files, deterministicScore } = input;
  const parts: string[] = [];

  parts.push(`# Vibe Hackathon Submission Evaluation

Evaluate the following hackathon submission. Return ONLY a valid JSON object — no prose, no markdown fences.

## Submission Metadata

- **Project**: ${submission.projectTitle ?? "Untitled"}
- **Team**: ${submission.teamName}
- **GitHub**: ${submission.githubUrl ?? "not provided"}
- **Demo URL**: ${submission.demoUrl ?? "not provided"}
- **Budget tier**: ${submission.budgetTier ?? "not reported"}
- **Agent harnesses**: ${submission.agentHarnesses?.join(", ") ?? "not reported"}
- **Models used**: ${submission.agentModels?.join(", ") ?? "not reported"}
- **Estimated human hours**: ${submission.estimatedHumanHours ?? "not reported"}
- **Estimated agent hours**: ${submission.estimatedAgentHours ?? "not reported"}
- **License**: ${submission.license ?? "not reported"}`);

  if (deterministicScore) {
    parts.push(`## Deterministic Repo Scores

- Repo structure: ${deterministicScore.repo_score}/100
- Documentation: ${deterministicScore.documentation_score}/100
- Reproducibility: ${deterministicScore.reproducibility_score}/100
- Deployment: ${deterministicScore.deployment_score}/100
- Agent readiness: ${deterministicScore.agent_readiness_score}/100
- Warnings: ${deterministicScore.warnings.join("; ") || "none"}`);
  }

  if (files?.readme?.content) {
    parts.push(`## README.md\n\n${files.readme.content.slice(0, 3000)}${files.readme.content.length > 3000 ? "\n\n[truncated]" : ""}`);
  }

  if (files?.agentsMd?.content) {
    parts.push(`## AGENTS.md\n\n${files.agentsMd.content.slice(0, 2000)}${files.agentsMd.content.length > 2000 ? "\n\n[truncated]" : ""}`);
  }

  if (files?.vibeSubmissionMd?.content) {
    parts.push(`## docs/vibe-submission.md\n\n${files.vibeSubmissionMd.content.slice(0, 2000)}${files.vibeSubmissionMd.content.length > 2000 ? "\n\n[truncated]" : ""}`);
  }

  if (files?.agentReportMd?.content) {
    parts.push(`## docs/agent-report.md\n\n${files.agentReportMd.content.slice(0, 1500)}${files.agentReportMd.content.length > 1500 ? "\n\n[truncated]" : ""}`);
  }

  if (files?.promptsMd?.content) {
    parts.push(`## docs/prompts.md\n\n${files.promptsMd.content.slice(0, 1000)}${files.promptsMd.content.length > 1000 ? "\n\n[truncated]" : ""}`);
  }

  parts.push(`## Scoring Instructions

Evaluate on these six dimensions (0–100 each):

- **product_sense_score**: Is this the right problem? Would real users pay for it?
- **originality_score**: Is the approach novel and interesting?
- **execution_score**: Does it reliably work? Is the codebase maintainable?
- **ai_collaboration_score**: Is there clear evidence of intentional human direction of AI agents?
- **usefulness_score**: Would this be genuinely useful to radiology professionals?
- **presentation_score**: Is the submission clear, well-documented, and well-communicated?
- **overall_score**: Your holistic assessment (not necessarily the mean of the above).

Penalize:
- Superficial demos that don't solve a real problem
- Unsupported claims (especially around token/cost/hour self-reports)
- Missing or thin documentation
- No evidence of agent workflow beyond basic autocomplete

Return ONLY this JSON:

{
  "product_sense_score": <0-100>,
  "originality_score": <0-100>,
  "execution_score": <0-100>,
  "ai_collaboration_score": <0-100>,
  "usefulness_score": <0-100>,
  "presentation_score": <0-100>,
  "overall_score": <0-100>,
  "risk_flags": ["<string>", ...],
  "rationale": "<2-4 sentence summary>",
  "suggested_human_questions": ["<question>", ...]
}`);

  return parts.join("\n\n");
}

function parseJudgeResponse(text: string): LLMJudgeScores {
  const cleaned = text.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();
  const parsed = JSON.parse(cleaned) as LLMJudgeScores;
  const numFields = [
    "product_sense_score", "originality_score", "execution_score",
    "ai_collaboration_score", "usefulness_score", "presentation_score", "overall_score",
  ] as const;
  for (const f of numFields) {
    (parsed as unknown as Record<string, unknown>)[f] = Math.max(0, Math.min(100, Number(parsed[f]) || 0));
  }
  if (!Array.isArray(parsed.risk_flags)) parsed.risk_flags = [];
  if (!Array.isArray(parsed.suggested_human_questions)) parsed.suggested_human_questions = [];
  return parsed;
}

async function runAnthropicJudge(input: LLMJudgeInput, modelName: string): Promise<LLMJudgeScores> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const prompt = buildJudgePrompt(input);
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: modelName,
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const data = await res.json() as { content: Array<{ text: string }> };
  return parseJudgeResponse(data.content[0]?.text ?? "");
}

async function runOpenAIJudge(input: LLMJudgeInput, modelName: string): Promise<LLMJudgeScores> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");

  const prompt = buildJudgePrompt(input);
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: modelName,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 2048,
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  const data = await res.json() as { choices: Array<{ message: { content: string } }> };
  return parseJudgeResponse(data.choices[0]?.message?.content ?? "");
}

// ── Public entrypoint ─────────────────────────────────────────────────────────

export async function runLLMJudge(
  input: LLMJudgeInput,
  provider: string,
  modelName: string
): Promise<LLMJudgeScores> {
  const mode = process.env.AI_JUDGE_MODE ?? "mock";

  if (mode === "mock" || provider === "mock") return runMockJudge(input);
  if (provider === "anthropic") return runAnthropicJudge(input, modelName);
  if (provider === "openai") return runOpenAIJudge(input, modelName);

  throw new Error(`Unsupported LLM provider: ${provider}. Set AI_JUDGE_MODE=mock to use mock mode.`);
}
