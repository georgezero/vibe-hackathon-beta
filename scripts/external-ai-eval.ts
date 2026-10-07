#!/usr/bin/env npx tsx
/**
 * External AI Evaluation Script
 *
 * Run LLM judging from a separate machine (Mac, workstation) that has API
 * keys or local models, while the Vibe Hackathon server handles data.
 *
 * Usage:
 *   BASE_URL=https://your-server.example.com \
 *   EVALUATION_TOKEN=eval_scoped-token-from-the-organizer \
 *   ANTHROPIC_API_KEY=sk-ant-... \
 *   npx tsx scripts/external-ai-eval.ts [submissionId]
 *
 * The organizer creates the scoped token with Copy Curl in the admin dashboard.
 * The token authorizes only the named submission's external evaluation flow.
 *
 * Or with curl:
 *   curl "$BASE_URL/api/v1/ai-eval/external/packet/$SUBMISSION_ID" \
 *     -H "Authorization: Bearer $EVALUATION_TOKEN" > packet.json
 *   curl "$BASE_URL/api/v1/ai-eval/external/prompt/$SUBMISSION_ID" \
 *     -H "Authorization: Bearer $EVALUATION_TOKEN" > prompt.md
 *   curl -X POST "$BASE_URL/api/v1/ai-eval/external/import/$SUBMISSION_ID" \
 *     -H "Authorization: Bearer $EVALUATION_TOKEN" \
 *     -H "Content-Type: application/json" \
 *     -d @result.json
 */

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const EVALUATION_TOKEN = process.env.EVALUATION_TOKEN;
const SUBMISSION_ID = process.argv[2];

function scopedHeaders() {
  if (!EVALUATION_TOKEN) {
    throw new Error(
      "EVALUATION_TOKEN is required. Ask an allowlisted organizer to use Copy Curl.",
    );
  }
  return { Authorization: `Bearer ${EVALUATION_TOKEN}` };
}

interface JudgeScores {
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

// ── Step 1: Fetch the judge packet ────────────────────────────────────────────

async function fetchPacket(submissionId: string) {
  console.log(`\n[1] Fetching judge packet for ${submissionId}...`);
  const res = await fetch(
    `${BASE_URL}/api/v1/ai-eval/external/packet/${submissionId}`,
    { headers: scopedHeaders() },
  );
  if (!res.ok) throw new Error(`Packet fetch failed: ${res.status} ${await res.text()}`);
  const packet = await res.json();
  console.log(`    Project: ${packet.submission.projectTitle ?? "Untitled"} — ${packet.submission.teamName}`);
  console.log(`    GitHub: ${packet.submission.githubUrl ?? "n/a"}`);
  if (packet.repo_files.fetch_error) {
    console.warn(`    ⚠ Repo fetch error: ${packet.repo_files.fetch_error}`);
  }
  return packet;
}

// ── Step 2: Fetch the prompt ──────────────────────────────────────────────────

async function fetchPrompt(submissionId: string): Promise<string> {
  console.log(`\n[2] Fetching judge prompt...`);
  const res = await fetch(
    `${BASE_URL}/api/v1/ai-eval/external/prompt/${submissionId}`,
    { headers: scopedHeaders() },
  );
  if (!res.ok) throw new Error(`Prompt fetch failed: ${res.status}`);
  const text = await res.text();
  console.log(`    Prompt length: ${text.length} chars`);
  return text;
}

// ── Step 3: Call external LLM ─────────────────────────────────────────────────

async function callAnthropicLLM(prompt: string, modelName = "claude-sonnet-4-6"): Promise<JudgeScores> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  console.log(`\n[3] Calling Anthropic ${modelName}...`);
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

  if (!res.ok) throw new Error(`Anthropic API error ${res.status}: ${await res.text()}`);
  const data = await res.json() as { content: Array<{ text: string }> };
  const text = data.content[0]?.text ?? "";

  const cleaned = text.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();
  return JSON.parse(cleaned) as JudgeScores;
}

async function callOpenAILLM(prompt: string, modelName = "gpt-4o"): Promise<JudgeScores> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");

  console.log(`\n[3] Calling OpenAI ${modelName}...`);
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

  if (!res.ok) throw new Error(`OpenAI API error ${res.status}: ${await res.text()}`);
  const data = await res.json() as { choices: Array<{ message: { content: string } }> };
  return JSON.parse(data.choices[0]?.message?.content ?? "{}") as JudgeScores;
}

// ── Step 4: Post result back to server ───────────────────────────────────────

async function importResult(
  submissionId: string,
  provider: string,
  modelName: string,
  scores: JudgeScores
) {
  console.log(`\n[4] Importing result back to server...`);
  const res = await fetch(
    `${BASE_URL}/api/v1/ai-eval/external/import/${submissionId}`,
    {
      method: "POST",
      headers: {
        ...scopedHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        submission_id: submissionId,
        provider,
        model_name: modelName,
        scores_json: scores,
        rationale: scores.rationale,
        risk_flags: scores.risk_flags,
        suggested_human_questions: scores.suggested_human_questions,
      }),
    },
  );

  if (!res.ok) throw new Error(`Import failed: ${res.status} ${await res.text()}`);
  const result = await res.json() as { id: string; status: string };
  console.log(`    ✓ Saved as run ${result.id}`);
  return result;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  if (!SUBMISSION_ID) {
    console.error("Usage: npx tsx scripts/external-ai-eval.ts <submissionId>");
    console.error("\nCurl examples:");
    console.error(`  # Download packet:`);
    console.error(`  curl "${BASE_URL}/api/v1/ai-eval/external/packet/sub_xxxx" \\`);
    console.error(`    -H "Authorization: Bearer $EVALUATION_TOKEN" > packet.json`);
    console.error(`\n  # Download prompt:`);
    console.error(`  curl "${BASE_URL}/api/v1/ai-eval/external/prompt/sub_xxxx" \\`);
    console.error(`    -H "Authorization: Bearer $EVALUATION_TOKEN" > prompt.md`);
    console.error(`\n  # Import result:`);
    console.error(`  curl -X POST "${BASE_URL}/api/v1/ai-eval/external/import/sub_xxxx" \\`);
    console.error(`    -H "Authorization: Bearer $EVALUATION_TOKEN" \\`);
    console.error(`    -H "Content-Type: application/json" \\`);
    console.error(`    -d '{"submission_id":"sub_xxxx","provider":"anthropic","model_name":"claude-sonnet-4-6","scores_json":{...}}'`);
    process.exit(1);
  }

  try {
    await fetchPacket(SUBMISSION_ID);
    const prompt = await fetchPrompt(SUBMISSION_ID);

    // Choose LLM backend based on available API keys
    let scores: JudgeScores;
    let provider: string;
    let modelName: string;

    if (process.env.ANTHROPIC_API_KEY) {
      provider = "anthropic";
      modelName = process.env.MODEL_NAME ?? "claude-sonnet-4-6";
      scores = await callAnthropicLLM(prompt, modelName);
    } else if (process.env.OPENAI_API_KEY) {
      provider = "openai";
      modelName = process.env.MODEL_NAME ?? "gpt-4o";
      scores = await callOpenAILLM(prompt, modelName);
    } else {
      console.error("\nNo API key found. Set ANTHROPIC_API_KEY or OPENAI_API_KEY.");
      console.error("To run manually: copy the prompt from the admin UI and paste into any LLM.");
      console.error("Then import the JSON result via the admin UI or the import endpoint.");
      process.exit(1);
    }

    console.log(`\n    Scores: overall=${scores.overall_score} product=${scores.product_sense_score} exec=${scores.execution_score}`);

    await importResult(SUBMISSION_ID, provider, modelName, scores);

    console.log(`\n✓ Done. View result at ${BASE_URL}/admin/dashboard (AI Reviews tab).`);
  } catch (err) {
    console.error("\n✗ Error:", err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main();
