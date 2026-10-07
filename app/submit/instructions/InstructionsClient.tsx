"use client";

import { useState } from "react";
import Link from "next/link";

const STEP_API = `# 1. Fetch the spec
curl https://your-event.example.com/api/v1/spec

# 2. Create submission from vibe.json
RESULT=$(curl -sX POST https://your-event.example.com/api/v1/submissions/from-repo \\
  -H "Content-Type: application/json" \\
  -d "{\\"vibe_json\\": $(cat vibe.json)}")

# 3. Store your edit token
export VIBE_SUBMISSION_ID=$(echo $RESULT | jq -r '.id')
export VIBE_EDIT_TOKEN=$(echo $RESULT | jq -r '.editToken')

# 4. Validate your repo before submitting
curl -X POST https://your-event.example.com/api/v1/validate-repo \\
  -H "Content-Type: application/json" \\
  -d '{"github_url": "https://github.com/your-org/your-repo"}'

# 5. Update any field before the deadline
curl -X PATCH https://your-event.example.com/api/v1/submissions/$VIBE_SUBMISSION_ID \\
  -H "Authorization: Bearer $VIBE_EDIT_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"screenshotUrl": "https://your-demo.vercel.app/screenshot.png", "source": "api"}'

# 6. Finalize (triggers AI repo review)
curl -X POST https://your-event.example.com/api/v1/submissions/$VIBE_SUBMISSION_ID/finalize \\
  -H "Authorization: Bearer $VIBE_EDIT_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"source": "api"}'

# 7. Check status
curl https://your-event.example.com/api/v1/submissions/$VIBE_SUBMISSION_ID/status`;

const STEP_MCP = `# Add to your MCP config (claude_desktop_config.json or similar)
{
  "mcpServers": {
    "vibe": {
      "command": "npx",
      "args": ["tsx", "scripts/mcp-server.ts"],
      "env": { "VIBE_BASE_URL": "https://your-event.example.com" }
    }
  }
}

# Then in your agent session:
# vibe.list_requirements    → fetch spec and valid field values
# vibe.validate_repo        → score your GitHub repo
# vibe.create_submission    → create draft, returns { id, editToken }
# vibe.update_submission    → update fields before deadline
# vibe.finalize_submission  → mark ready, triggers AI review
# vibe.get_submission_status → check current state`;

const VIBE_JSON_STARTER = `{
  "schema": "vibe-hackathon-submission-v1",
  "team": {
    "name": "Your Team Name",
    "contact_email": "team@example.com",
    "members": [
      { "name": "Alice", "role": "Full-stack + AI" }
    ],
    "github_org": "your-github-org"
  },
  "project": {
    "name": "Your Project Title",
    "summary": "One sentence describing the problem and how your AI-assisted approach solves it.",
    "demo_url": "https://your-project.vercel.app",
    "github_url": "https://github.com/your-org/your-repo",
    "screenshot_url": "https://your-project.vercel.app/screenshot.png",
    "target_users": ["radiologists", "medical imaging teams"],
    "tags": ["medical imaging", "AI"]
  },
  "repo": {
    "license": "MIT",
    "agents_md_url": "https://github.com/your-org/your-repo/blob/main/AGENTS.md",
    "readme_url": "https://github.com/your-org/your-repo/blob/main/README.md",
    "install": "npm install",
    "run": "npm run dev",
    "sample_data": "20 synthetic records seeded via npm run db:seed."
  },
  "agentic_dev": {
    "harnesses": ["Claude Code"],
    "models": ["claude-sonnet-4-6"],
    "budget_tier": "api_10_to_50",
    "estimated_human_hours": 12,
    "estimated_agent_hours": 48
  }
}`;

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button
      onClick={copy}
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: "0.6875rem",
        padding: "0.25rem 0.625rem",
        borderRadius: 6,
        border: "1px solid var(--color-border)",
        background: copied ? "color-mix(in srgb, var(--color-accent) 15%, transparent)" : "var(--color-surface)",
        color: copied ? "var(--color-accent)" : "var(--color-muted)",
        cursor: "pointer",
        transition: "all 0.15s",
      }}
    >
      {copied ? "Copied!" : label}
    </button>
  );
}

const REQUIRED_FILES = [
  { file: "vibe.json", desc: "Machine-readable manifest — the canonical submission record" },
  { file: "README.md", desc: "Project overview, install, and usage" },
  { file: "AGENTS.md", desc: "Instructions for coding agents to run/deploy the repo" },
  { file: "LICENSE", desc: "Open-source license (MIT or BSD-3-Clause preferred)" },
  { file: ".env.example", desc: "Env var template — no real secrets" },
];

const RECOMMENDED_FILES = [
  { file: "docs/vibe-submission.md", desc: "Narrative submission form — extra scoring bonus" },
  { file: "docs/agent-report.md", desc: "Detailed agent workflow evidence — extra scoring bonus" },
  { file: "docs/prompts.md", desc: "Key prompts used during development" },
  { file: "docker-compose.yml", desc: "Adds deployment scoring points" },
];

const STEPS = [
  "Build your project with an AI agent",
  "Create README.md with install, run, and usage sections",
  "Create AGENTS.md so another agent can run your project cold",
  "Add a LICENSE file (MIT or BSD-3-Clause preferred)",
  "Create .env.example with all required variables (no real values)",
  "Create vibe.json in your repo root",
  "Create a draft submission to get your edit token",
  "Store edit token in .env (never commit it)",
  "Update your submission fields before the deadline",
  "Finalize before the deadline — this triggers the AI repo review",
];

export default function InstructionsClient() {
  return (
    <div className="mx-auto max-w-4xl w-full px-4 sm:px-6 py-12 flex-1">

        {/* Header */}
        <div style={{ marginBottom: "3rem" }}>
          <div className="flex items-center gap-3 mb-4">
            <Link href="/submit" style={{ color: "var(--color-subtle)", fontSize: "0.8125rem", textDecoration: "none" }}>← Back to submit</Link>
          </div>
          <span className="badge badge-default" style={{ marginBottom: "1rem" }}>Submission Guide</span>
          <h1
            style={{
              fontFamily: "var(--font-headline)",
              fontSize: "clamp(1.75rem, 4vw, 2.75rem)",
              fontWeight: 800,
              letterSpacing: "-0.03em",
              color: "var(--color-fg)",
              marginBottom: "0.75rem",
            }}
          >
            How to submit
          </h1>
          <p style={{ color: "var(--color-muted)", fontSize: "1rem", lineHeight: 1.65, maxWidth: 600 }}>
            This is an agent-native competition. You can submit via the web form, the REST API, or an MCP tool — all paths lead to the same platform.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: main content */}
          <div className="lg:col-span-2 flex flex-col gap-10">

            {/* Quick start */}
            <section>
              <h2 style={{ fontWeight: 700, color: "var(--color-fg)", fontSize: "1.125rem", marginBottom: "1rem" }}>Quick start</h2>
              <div className="flex flex-col gap-2">
                {STEPS.map((step, i) => (
                  <div key={i} className="flex gap-3 items-start">
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.6875rem", color: "var(--color-accent)", fontWeight: 700, minWidth: "1.5rem", paddingTop: "0.2rem" }}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span style={{ fontSize: "0.875rem", color: "var(--color-muted)", lineHeight: 1.55 }}>{step}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* API workflow */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 style={{ fontWeight: 700, color: "var(--color-fg)", fontSize: "1.125rem" }}>Agent / API workflow</h2>
                <CopyButton text={STEP_API} label="Copy" />
              </div>
              <p style={{ color: "var(--color-muted)", fontSize: "0.8125rem", marginBottom: "0.75rem", lineHeight: 1.6 }}>
                The fastest path for AI agents. Three curl calls — create, update, finalize. Replace the example URL with the actual event URL.
              </p>
              <div
                className="card"
                style={{ padding: "1rem 1.25rem", background: "var(--color-surface)", overflow: "auto" }}
              >
                <pre style={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem", color: "var(--color-muted)", margin: 0, lineHeight: 1.7, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                  {STEP_API}
                </pre>
              </div>
            </section>

            {/* MCP workflow */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 style={{ fontWeight: 700, color: "var(--color-fg)", fontSize: "1.125rem" }}>MCP tool workflow</h2>
                <CopyButton text={STEP_MCP} label="Copy" />
              </div>
              <p style={{ color: "var(--color-muted)", fontSize: "0.8125rem", marginBottom: "0.75rem", lineHeight: 1.6 }}>
                If your agent uses Claude Code or another MCP client, add the Vibe server to your config and use the tools directly.
              </p>
              <div
                className="card"
                style={{ padding: "1rem 1.25rem", background: "var(--color-surface)", overflow: "auto" }}
              >
                <pre style={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem", color: "var(--color-muted)", margin: 0, lineHeight: 1.7, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                  {STEP_MCP}
                </pre>
              </div>
            </section>

            {/* vibe.json starter */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 style={{ fontWeight: 700, color: "var(--color-fg)", fontSize: "1.125rem" }}>vibe.json starter</h2>
                <div className="flex gap-2">
                  <CopyButton text={VIBE_JSON_STARTER} label="Copy JSON" />
                  <a
                    href="/templates/vibe.json"
                    download="vibe.json"
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "0.6875rem",
                      padding: "0.25rem 0.625rem",
                      borderRadius: 6,
                      border: "1px solid var(--color-border)",
                      background: "var(--color-surface)",
                      color: "var(--color-muted)",
                      textDecoration: "none",
                    }}
                  >
                    Download ↓
                  </a>
                </div>
              </div>
              <div
                className="card"
                style={{ padding: "1rem 1.25rem", background: "var(--color-surface)", overflow: "auto" }}
              >
                <pre style={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem", color: "var(--color-muted)", margin: 0, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                  {VIBE_JSON_STARTER}
                </pre>
              </div>
            </section>

            {/* Secret hygiene */}
            <section>
              <h2 style={{ fontWeight: 700, color: "var(--color-fg)", fontSize: "1.125rem", marginBottom: "0.75rem" }}>Secret hygiene</h2>
              <div className="card" style={{ padding: "1rem 1.25rem" }}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" style={{ fontSize: "0.8125rem" }}>
                  <div>
                    <div style={{ fontWeight: 600, color: "var(--color-fg)", marginBottom: "0.5rem" }}>Do</div>
                    <div className="flex flex-col gap-1.5">
                      {[
                        "Store edit token in .env (gitignored)",
                        "Share edit link only with your team",
                        "Use .env.example for variable templates",
                        "Keep ANTHROPIC_API_KEY out of git",
                      ].map((s) => (
                        <div key={s} style={{ color: "var(--color-muted)", display: "flex", gap: "0.5rem" }}>
                          <span style={{ color: "var(--color-accent)" }}>✓</span> {s}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, color: "var(--color-fg)", marginBottom: "0.5rem" }}>Don&apos;t</div>
                    <div className="flex flex-col gap-1.5">
                      {[
                        "Commit edit token to GitHub",
                        "Post edit link publicly",
                        "Put real values in .env.example",
                        "Hardcode API keys in source files",
                      ].map((s) => (
                        <div key={s} style={{ color: "var(--color-muted)", display: "flex", gap: "0.5rem" }}>
                          <span style={{ color: "#ef4444" }}>✗</span> {s}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </section>

          </div>

          {/* Right sidebar */}
          <div className="flex flex-col gap-4">

            {/* CTA */}
            <div className="card" style={{ padding: "1.25rem", background: "color-mix(in srgb, var(--color-accent) 8%, var(--color-surface))", border: "1px solid color-mix(in srgb, var(--color-accent) 20%, var(--color-border))" }}>
              <div style={{ fontWeight: 600, color: "var(--color-fg)", marginBottom: "0.5rem" }}>Ready to submit?</div>
              <p style={{ fontSize: "0.8125rem", color: "var(--color-muted)", lineHeight: 1.55, marginBottom: "1rem" }}>
                Create a draft to get your private edit token. Update any time before the deadline.
              </p>
              <Link href="/submit" className="btn-primary" style={{ justifyContent: "center", fontSize: "0.875rem" }}>
                Create draft →
              </Link>
            </div>

            {/* Required files */}
            <div className="card" style={{ padding: "1.25rem" }}>
              <div style={{ fontWeight: 600, color: "var(--color-fg)", fontSize: "0.875rem", marginBottom: "0.875rem" }}>Required files</div>
              <div className="flex flex-col gap-2">
                {REQUIRED_FILES.map(({ file, desc }) => (
                  <div key={file}>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--color-fg)", fontWeight: 600 }}>{file}</div>
                    <div style={{ fontSize: "0.6875rem", color: "var(--color-subtle)", lineHeight: 1.4, marginTop: "0.1rem" }}>{desc}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recommended files */}
            <div className="card" style={{ padding: "1.25rem" }}>
              <div style={{ fontWeight: 600, color: "var(--color-fg)", fontSize: "0.875rem", marginBottom: "0.875rem" }}>Recommended</div>
              <div className="flex flex-col gap-2">
                {RECOMMENDED_FILES.map(({ file, desc }) => (
                  <div key={file}>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--color-muted)" }}>{file}</div>
                    <div style={{ fontSize: "0.6875rem", color: "var(--color-subtle)", lineHeight: 1.4, marginTop: "0.1rem" }}>{desc}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Downloads */}
            <div className="card" style={{ padding: "1.25rem" }}>
              <div style={{ fontWeight: 600, color: "var(--color-fg)", fontSize: "0.875rem", marginBottom: "0.875rem" }}>Templates</div>
              <div className="flex flex-col gap-2">
                {[
                  { href: "/templates/vibe.json", name: "vibe.json", label: "vibe.json" },
                  { href: "/templates/AGENTS.md", name: "AGENTS.md", label: "AGENTS.md" },
                  { href: "/templates/SUBMISSION_AGENT.md", name: "SUBMISSION_AGENT.md", label: "SUBMISSION_AGENT.md" },
                ].map(({ href, name, label }) => (
                  <a
                    key={name}
                    href={href}
                    download={name}
                    className="btn-ghost"
                    style={{ fontSize: "0.8125rem", padding: "0.375rem 0.5rem", justifyContent: "space-between" }}
                  >
                    <span>{label}</span>
                    <span style={{ fontSize: "0.75rem" }}>↓</span>
                  </a>
                ))}
                <a
                  href="/api/v1/spec"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-ghost"
                  style={{ fontSize: "0.8125rem", padding: "0.375rem 0.5rem", justifyContent: "space-between" }}
                >
                  <span>Machine-readable spec</span>
                  <span>↗</span>
                </a>
              </div>
            </div>

            {/* API quick ref */}
            <div className="card" style={{ padding: "1.25rem" }}>
              <div style={{ fontWeight: 600, color: "var(--color-fg)", fontSize: "0.875rem", marginBottom: "0.875rem" }}>API endpoints</div>
              <div className="flex flex-col gap-1.5">
                {[
                  { method: "POST", path: "/api/v1/submissions/from-repo" },
                  { method: "PATCH", path: "/api/v1/submissions/:id" },
                  { method: "POST", path: "/api/v1/submissions/:id/finalize" },
                  { method: "GET", path: "/api/v1/submissions/:id/status" },
                  { method: "POST", path: "/api/v1/validate-repo" },
                  { method: "GET", path: "/api/v1/spec" },
                ].map(({ method, path }) => (
                  <div key={path} style={{ fontFamily: "var(--font-mono)", fontSize: "0.625rem" }}>
                    <span style={{ color: "var(--color-accent)", marginRight: "0.5rem" }}>{method}</span>
                    <span style={{ color: "var(--color-muted)" }}>{path}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* MCP quick ref */}
            <div className="card" style={{ padding: "1.25rem" }}>
              <div style={{ fontWeight: 600, color: "var(--color-fg)", fontSize: "0.875rem", marginBottom: "0.875rem" }}>MCP tools</div>
              <div className="flex flex-col gap-1" style={{ fontFamily: "var(--font-mono)", fontSize: "0.625rem", color: "var(--color-muted)" }}>
                {[
                  "vibe.list_requirements",
                  "vibe.validate_repo",
                  "vibe.create_submission",
                  "vibe.update_submission",
                  "vibe.finalize_submission",
                  "vibe.get_submission_status",
                ].map((tool) => (
                  <div key={tool}>{tool}</div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>
  );
}
