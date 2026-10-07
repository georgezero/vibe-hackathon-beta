import { NextResponse } from "next/server";
import { VIBE_JSON_REQUIREMENTS } from "@/lib/vibe-json";

export async function GET() {
  return NextResponse.json({
    ...VIBE_JSON_REQUIREMENTS,
    api_endpoints: {
      create_submission: "POST /api/v1/submissions",
      create_from_vibe_json: "POST /api/v1/submissions/from-repo",
      update_submission: "PATCH /api/v1/submissions/:id",
      update_team: "PATCH /api/v1/submissions/:id/team",
      finalize_submission: "POST /api/v1/submissions/:id/finalize",
      submit_repo_analysis: "POST /api/v1/submissions/:id/repo-analysis",
      get_status: "GET /api/v1/submissions/:id/status",
      cast_vote: "POST /api/votes",
    },
    agent_report: {
      path: "docs/agent-report.md",
      required: false,
      sections: [
        "Architecture decisions",
        "Major prompts",
        "Feature cuts",
        "Failed approaches",
        "Debugging strategy",
        "Agent roles",
      ],
    },
    important_agent_rules: [
      "Creating local files is not enough. The hosted draft must be updated with PATCH /api/v1/submissions/:id.",
      "Team member information must be updated with PATCH /api/v1/submissions/:id/team.",
      "Use Authorization: Bearer <edit_token> for update and finalize endpoints.",
      "Do not finalize unless explicitly instructed by the human team lead.",
    ],
    spec_docs: "/docs/SUBMISSION_SPEC_v1.md",
    mcp_docs: "/docs/MCP.md",
  });
}
