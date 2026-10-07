"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

interface Props {
  submissionId: string;
  editToken: string;
  editUrl: string;
  previewUrl: string;
  finalizeUrl: string | null;
  baseUrl?: string;
  missingFields?: string[];
  weakFields?: string[];
  compact?: boolean;
  promptDisclosure?: boolean;
  title?: string;
  mode?: "setup" | "completion";
  setupVariant?: "initial" | "current";
  currentOwner?: {
    name: string;
    email: string | null;
    badgeNumber: string | null;
    affiliation: string | null;
    degrees: string | null;
    isStudentTrainee: boolean;
  } | null;
  currentMembers?: Array<{
    name: string;
    email: string | null;
    badgeNumber: string | null;
    affiliation: string | null;
    degrees: string | null;
    isStudentTrainee: boolean;
  }>;
}

function resolveBaseUrl(explicit: string | undefined, editUrl: string) {
  if (explicit) return explicit;
  try {
    return new URL(editUrl).origin;
  } catch {
    if (typeof window !== "undefined") return window.location.origin;
    return "";
  }
}

export function AgentCompletionPrompt({
  submissionId,
  editToken,
  editUrl,
  previewUrl,
  finalizeUrl,
  baseUrl,
  missingFields = [],
  weakFields = [],
  compact = false,
  promptDisclosure = false,
  title = "Use a coding agent",
  mode = "completion",
  setupVariant = "current",
  currentOwner = null,
  currentMembers = [],
}: Props) {
  const [copied, setCopied] = useState(false);
  const origin = resolveBaseUrl(baseUrl, editUrl);
  const apiSpecUrl = `${origin}/api/v1/requirements`;
  const instructionsUrl = `${origin}/submit/instructions`;

  const prompt = useMemo(() => {
    const ownerBlock = currentOwner
      ? `Current registered owner / team lead:
- Name: ${currentOwner.name}
- Email: ${currentOwner.email ?? ""}
- Badge number: ${currentOwner.badgeNumber ?? ""}
- Affiliation / institution: ${currentOwner.affiliation ?? ""}
- Degree(s): ${currentOwner.degrees ?? ""}
- Student / trainee: ${currentOwner.isStudentTrainee ? "Yes" : "No"}`
      : "Current registered owner / team lead: not loaded";
    const setupMembers = setupVariant === "initial" ? [] : currentMembers;
    const memberBlock = setupMembers.length
      ? setupMembers.map((member, index) => `Current teammate ${index + 1}:
- Name: ${member.name}
- Email: ${member.email ?? ""}
- Badge number: ${member.badgeNumber ?? ""}
- Affiliation / institution: ${member.affiliation ?? ""}
- Degree(s): ${member.degrees ?? ""}
- Student / trainee: ${member.isStudentTrainee ? "Yes" : "No"}`).join("\n\n")
      : "Current teammates: none";

    if (mode === "setup") {
      return `Update this Vibe Hackathon draft with initial team and project setup.

Submission ID: ${submissionId}
Edit token: ${editToken}
Base URL: ${origin}
Edit URL: ${editUrl}
Preview URL: ${previewUrl}
API spec URL: ${apiSpecUrl}
Submission instructions URL: ${instructionsUrl}

Security: The Edit token is confidential bearer access. Never commit it to a repository, print it in public logs, include it in screenshots, or paste it into public issues or chat rooms. Use it only in the hosted API Authorization header below. Return only safe confirmation and the preview URL; never return the Edit token.

Context:
- A human team owner already registered this team.
- Use the private edit token to update this existing hosted draft.
- Creating local files is not enough. You must PATCH the hosted Vibe Hackathon API.
- This step is only for team information and project name.

${setupVariant === "initial" ? "Initial Team Setup Context" : "Current Hosted Team State"}

${setupVariant === "initial"
  ? "Use the registered team lead below as the owner. This prompt intentionally omits existing teammates so the human can provide a fresh intended roster."
  : "The team roster shown below is the latest saved team state, including any prior manual or agent updates. It is the source of truth for the current roster."}

${ownerBlock}

${memberBlock}

Required hosted API updates:

1. Update project shell fields:

PATCH ${origin}/api/v1/submissions/${submissionId}
Authorization: Bearer ${editToken}
Content-Type: application/json

Suggested body fields:
{
  "teamName": "Team name if changed",
  "contactEmail": "owner@example.com",
  "projectTitle": "Project name"
}

2. Update team fields:

PATCH ${origin}/api/v1/submissions/${submissionId}/team
Authorization: Bearer ${editToken}
Content-Type: application/json

Team updates are replace-style. Send the complete intended roster every time.
- To keep a teammate, include them unchanged in members[].
- To update a teammate, include them with updated fields.
- To remove a teammate, omit them from members[].
- Do not revert to older registration details unless the human explicitly asks.
${setupVariant === "initial" ? "- This initial prompt omits existing teammates by design. Add only teammates provided by the human in this run." : ""}

Example:
Current roster:
- Owner: Elena Park
- Marcus Hill
- Priya Shah
- Daniel Kim

If the intended roster is:
- Owner: Elena Park
- Marcus Hill
- Priya Shah

Then send members[] containing Marcus and Priya only. Daniel will be removed.

Suggested body:
{
  "owner": {
    "name": "Team lead name",
    "email": "lead@example.com",
    "badgeNumber": "BADGE-001",
    "affiliation": "Institution",
    "degrees": "MD",
    "isStudentTrainee": false
  },
  "members": [
    {
      "name": "Teammate name",
      "email": "teammate@example.com",
      "badgeNumber": "BADGE-002",
      "affiliation": "Institution",
      "degrees": "MS",
      "isStudentTrainee": true
    }
  ]
}

Important team counting rule:
- The team lead / owner MUST be sent in the top-level "owner" object.
- The "members" array is for additional teammates only.
- Total team size shown in preview = 1 owner + members.length.
- For a 4-person team, send 1 owner and 3 members. Preview should show Team Size 4 / 6 and Badge Completion 4 / 4 when all four have badge numbers.
- Preserve the current registered owner as the owner unless the human explicitly provides replacement owner information.
- If owner details are incomplete, preserve existing non-empty owner values and leave unknown optional fields blank.
- Do not invent placeholder owner names, emails, or badge numbers.

Rules:
- Update project title if provided.
- Update team owner/member information if provided.
- Do not inspect the repository yet.
- Do not create or edit repo files yet.
- Do not fill full project details yet.
- Do not invent teammate information.
- Leave unknown fields blank.
- This is a replace-style team update. Include the full intended roster every time: current owner plus all intended teammates, including unchanged people.
- Do not finalize.

After updating:
- Open or check the preview URL.
- Confirm the hosted preview shows the updated project name and team eligibility.
- Return the preview URL to the human.`;
    }

    return `Complete this Vibe Hackathon draft submission.

Submission ID: ${submissionId}
Edit token: ${editToken}
Base URL: ${origin}
Edit URL: ${editUrl}
Preview URL: ${previewUrl}
Finalize URL: ${finalizeUrl ?? "Not available"}
API spec URL: ${apiSpecUrl}
Submission instructions URL: ${instructionsUrl}

Security: The Edit token is confidential bearer access. Never commit it to a repository, print it in public logs, include it in screenshots, or paste it into public issues or chat rooms. Use it only in the hosted API Authorization header below. Return only safe confirmation and the preview URL; never return the Edit token.

Context:
- A human team owner already registered this team.
- Use the private edit token to update the existing draft.
- Do not create a new team unless explicitly instructed.
- Creating or editing local repo files is not enough. You must PATCH the hosted Vibe Hackathon draft API.

Required hosted API updates:

1. Update submission/project fields:

PATCH ${origin}/api/v1/submissions/${submissionId}
Authorization: Bearer ${editToken}
Content-Type: application/json

2. Update team fields:

PATCH ${origin}/api/v1/submissions/${submissionId}/team
Authorization: Bearer ${editToken}
Content-Type: application/json

Team updates are replace-style. Send the complete intended roster every time.
- To keep a teammate, include them unchanged in members[].
- To update a teammate, include them with updated fields.
- To remove a teammate, omit them from members[].
- Do not revert to older registration details unless the human explicitly asks.

Example:
Current roster:
- Owner: Elena Park
- Marcus Hill
- Priya Shah
- Daniel Kim

If the intended roster is:
- Owner: Elena Park
- Marcus Hill
- Priya Shah

Then send members[] containing Marcus and Priya only. Daniel will be removed.

Example team update body:

{
  "owner": {
    "name": "Team lead name",
    "email": "lead@example.com",
    "badgeNumber": "BADGE-001",
    "affiliation": "Institution",
    "degrees": "MD",
    "isStudentTrainee": false
  },
  "members": [
    {
      "name": "Teammate name",
      "email": "teammate@example.com",
      "badgeNumber": "BADGE-002",
      "affiliation": "Institution",
      "degrees": "MS",
      "isStudentTrainee": true
    }
  ]
}

Important team counting rule:
- The team lead / owner MUST be sent in the top-level "owner" object.
- The "members" array is for additional teammates only.
- Total team size shown in preview = 1 owner + members.length.
- For a 4-person team, send 1 owner and 3 members. Preview should show Team Size 4 / 6 and Badge Completion 4 / 4 when all four have badge numbers.

Your task:
- Inspect the GitHub repository if one is provided by the human.
- Create or update vibe.json.
- Create or update docs/vibe-submission.md if useful.
- Complete team details if provided by the human.
- Complete project details accurately.
- Add screenshot URLs.
- Add demo video URL if available.
- Add AI harness/model metadata.
- Update the hosted draft through the API or MCP. Do not stop after creating local files.
- Verify the hosted preview reflects the changes before reporting success.
- Return the preview URL to the human for review.
- Do NOT finalize unless explicitly instructed by the human team lead.

Team details to collect/update if the human provides them:
- teammate names
- emails
- badge numbers
- affiliations/institutions
- degrees
- student/trainee status

Team rules:
- Do not invent teammate information.
- Leave unknown team fields blank.
- Badge numbers are private eligibility data and must not be exposed publicly.

Missing fields to prioritize:
${missingFields.length ? missingFields.map((field) => `- ${field}`).join("\n") : "- Use the submission instructions to identify remaining gaps."}

Weak fields to improve:
${weakFields.length ? weakFields.map((field) => `- ${field}`).join("\n") : "- None identified yet."}`;
  }, [apiSpecUrl, currentMembers, currentOwner, editToken, editUrl, finalizeUrl, instructionsUrl, missingFields, mode, origin, previewUrl, setupVariant, submissionId, weakFields]);

  async function copyPrompt() {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="card" style={{ padding: compact ? "1rem" : "1.25rem" }}>
      <div className="flex items-start justify-between gap-3 flex-wrap" style={{ marginBottom: compact ? "0.75rem" : "1rem" }}>
        <div>
          <h2 style={{ color: "var(--color-fg)", fontWeight: 850, fontSize: compact ? "1rem" : "1.2rem", marginBottom: "0.35rem" }}>{title}</h2>
          <p style={{ color: "var(--color-muted)", fontSize: "0.8125rem", lineHeight: 1.55 }}>
            Copy this private prompt into Codex, Claude Code, Cursor, OpenCode, or another coding agent.
          </p>
        </div>
        <button type="button" onClick={copyPrompt} className="btn-primary" style={{ justifyContent: "center" }}>
          {copied ? "Copied" : "Copy agent prompt"}
        </button>
      </div>
      {!compact && !promptDisclosure && (
        <pre style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)", borderRadius: 12, padding: "1rem", color: "var(--color-muted)", fontFamily: "var(--font-mono)", fontSize: "0.72rem", lineHeight: 1.65, whiteSpace: "pre-wrap", maxHeight: "24rem", overflow: "auto" }}>
          {prompt}
        </pre>
      )}
      {!compact && promptDisclosure && (
        <details style={{ marginTop: "0.85rem" }}>
          <summary style={{ color: "var(--color-muted)", cursor: "pointer", fontSize: "0.8rem" }}>View the prompt contents (advanced)</summary>
          <pre style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)", borderRadius: 12, padding: "1rem", color: "var(--color-muted)", fontFamily: "var(--font-mono)", fontSize: "0.72rem", lineHeight: 1.65, whiteSpace: "pre-wrap", maxHeight: "24rem", overflow: "auto", marginTop: "0.7rem" }}>
            {prompt}
          </pre>
        </details>
      )}
      <div className="flex flex-wrap gap-2" style={{ marginTop: "1rem" }}>
        <Link href={previewUrl.replace(origin, "") || previewUrl} className="btn-secondary">Review project preview</Link>
        <Link href="/api/v1/requirements" className="btn-ghost">API documentation</Link>
        <Link href="/submit/instructions" className="btn-ghost">Submission instructions</Link>
      </div>
      <p style={{ color: "var(--color-subtle)", fontSize: "0.75rem", lineHeight: 1.5, marginTop: "0.875rem" }}>
        When the agent finishes, return here to review the preview. This prompt contains a private edit token; do not share it publicly. Agents should stop at preview unless the human team lead explicitly asks them to finalize.
      </p>
    </div>
  );
}
