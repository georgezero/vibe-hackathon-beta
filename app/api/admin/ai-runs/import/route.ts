import { NextRequest } from "next/server";
import { withAdminApi } from "@/lib/admin-api";
import { importAiEvaluation } from "@/lib/ai-evaluation-import";

// POST /api/admin/ai-runs/import
// Organizer-session import. Scoped external automation uses /api/v1/ai-eval/external.
async function importAiRun(req: NextRequest) {
  return importAiEvaluation(req, { allowBodyEvaluationToken: true });
}

export const POST = withAdminApi("POST /api/admin/ai-runs/import", importAiRun);
