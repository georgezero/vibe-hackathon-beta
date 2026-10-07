import { headers } from "next/headers";
import { SubmissionWorkspaceShell } from "@/components/SubmissionWorkspaceShell";
import { JudgeWorkspaceTeam } from "@/components/JudgeWorkspaceViews";
import { requireJudgeWorkspace } from "@/lib/judge-workspace";

export const dynamic = "force-dynamic";

export default async function JudgeWorkspaceTeamPage({ params }: { params: Promise<{ submissionId: string }> }) {
  const { submissionId } = await params;
  const workspace = await requireJudgeWorkspace(submissionId, await headers());
  return <SubmissionWorkspaceShell context={workspace.context} principal={workspace.principal} currentTab="team" viewer="judge" basePath={`/judge/projects/${encodeURIComponent(submissionId)}`}><JudgeWorkspaceTeam workspace={workspace} /></SubmissionWorkspaceShell>;
}
