import { headers } from "next/headers";
import { SubmissionWorkspaceShell } from "@/components/SubmissionWorkspaceShell";
import { JudgeWorkspaceOverview } from "@/components/JudgeWorkspaceViews";
import { requireJudgeWorkspace } from "@/lib/judge-workspace";

export const dynamic = "force-dynamic";

export default async function JudgeWorkspaceOverviewPage({ params }: { params: Promise<{ submissionId: string }> }) {
  const { submissionId } = await params;
  const workspace = await requireJudgeWorkspace(submissionId, await headers());
  return <SubmissionWorkspaceShell context={workspace.context} principal={workspace.principal} currentTab="overview" viewer="judge" basePath={`/judge/projects/${encodeURIComponent(submissionId)}`}><JudgeWorkspaceOverview workspace={workspace} /></SubmissionWorkspaceShell>;
}
