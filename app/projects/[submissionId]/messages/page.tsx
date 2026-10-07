import { headers } from "next/headers";
import { SubmissionWorkspaceShell } from "@/components/SubmissionWorkspaceShell";
import { WorkspaceAccessState } from "@/components/WorkspaceAccessState";
import { resolveSubmissionWorkspace } from "@/lib/submission-workspace";
import { isNativeTeamChatEnabled } from "@/lib/native-chat-config";
import { TeamRoomClient } from "./TeamRoomClient";

export const dynamic = "force-dynamic";

export default async function SubmissionMessagesPage({ params }: { params: Promise<{ submissionId: string }> }) {
  const { submissionId } = await params;
  const resolution = await resolveSubmissionWorkspace(submissionId, await headers());
  if (resolution.status !== "ok") return <WorkspaceAccessState status={resolution.status} submissionId={submissionId} resource="messages" />;
  const { context, principal } = resolution;
  if (!isNativeTeamChatEnabled(submissionId)) return <SubmissionWorkspaceShell context={context} principal={principal} currentTab="messages"><section className="card" style={{ padding: "2rem", textAlign: "center" }}><span className="badge badge-default">Private Team Chat</span><h2 style={{ color: "var(--color-fg)", fontSize: "1.4rem", marginTop: "0.8rem" }}>Team Chat is not enabled for this project yet</h2><p style={{ color: "var(--color-muted)", lineHeight: 1.6, margin: "0.7rem auto 1.2rem", maxWidth: "34rem" }}>This private project workspace is ready. Team Chat will become available when the project is included in the limited rollout.</p><span className="badge badge-default">Your project and account are unaffected</span></section></SubmissionWorkspaceShell>;
  return <SubmissionWorkspaceShell context={context} principal={principal} currentTab="messages"><TeamRoomClient submissionId={submissionId} /></SubmissionWorkspaceShell>;
}
