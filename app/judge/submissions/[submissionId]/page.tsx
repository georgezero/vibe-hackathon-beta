import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireJudgeWorkspace } from "@/lib/judge-workspace";
import { requireAuthorizedJudgePage } from "@/lib/judge-page-auth";

export const dynamic = "force-dynamic";

/** Compatibility entry: assigned reviews now live in the unified workspace. */
export default async function LegacyJudgeSubmissionPage({ params }: { params: Promise<{ submissionId: string }> }) {
  const { submissionId } = await params;
  await requireAuthorizedJudgePage();
  await requireJudgeWorkspace(submissionId, await headers());
  redirect(`/judge/projects/${encodeURIComponent(submissionId)}/evaluation`);
}
