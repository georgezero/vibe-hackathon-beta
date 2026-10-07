import Link from "next/link";
import { headers } from "next/headers";
import { desc, eq } from "drizzle-orm";
import { SubmissionWorkspaceShell } from "@/components/SubmissionWorkspaceShell";
import { resolveSubmissionWorkspace } from "@/lib/submission-workspace";
import { isNativeTeamChatEnabled } from "@/lib/native-chat-config";
import { listChatMessages } from "@/lib/native-chat";
import { chatRooms } from "@/lib/db/schema";
import { db } from "@/lib/db";
import { WorkspaceAccessState } from "@/components/WorkspaceAccessState";

export const dynamic = "force-dynamic";
type RecentChatMessage = Awaited<ReturnType<typeof listChatMessages>>["messages"][number];

export default async function WorkspaceOverviewPage({ params, searchParams }: { params: Promise<{ submissionId: string }>; searchParams?: Promise<{ joined?: string }> }) {
  const { submissionId } = await params;
  const resolution = await resolveSubmissionWorkspace(submissionId, await headers());
  if (resolution.status !== "ok") return <WorkspaceAccessState status={resolution.status} submissionId={submissionId} />;
  const { context, principal } = resolution;
  const joined = (await searchParams)?.joined === "1";
  const owner = context.membership.role === "owner";
  const chatEnabled = isNativeTeamChatEnabled(submissionId);
  const room = chatEnabled ? (await db.select({ id: chatRooms.id }).from(chatRooms).where(eq(chatRooms.submissionId, submissionId)).orderBy(desc(chatRooms.createdAt)).limit(1))[0] : undefined;
  const recentMessages = room ? (await listChatMessages({ roomId: room.id, userId: principal.user.id, limit: 3 }).catch(() => ({ messages: [] }))).messages : [];
  return <SubmissionWorkspaceShell context={context} principal={principal} currentTab="overview">
    <div className="workspace-page">
      {joined && <div className="team-success-note" role="status"><strong>You&apos;re on the team.</strong><span>{context.submission.projectTitle || context.submission.teamName} is now available in your project workspace.</span><Link href={`/account/projects`}>My Projects</Link></div>}
      <section className="workspace-hero"><div><h2>{context.submission.problemStatement || "Your project workspace"}</h2><p>{context.submission.targetUsers || "Keep the team aligned, review readiness, and prepare the submission."}</p></div><div className="workspace-status-stack"><span className={`badge ${context.readiness.status === "ready" ? "badge-success" : "badge-warning"}`}>{context.readiness.status === "finalized" ? "Submitted" : `${context.readiness.completionPercent}% ready`}</span><span className="badge badge-default">{owner ? "Team lead workspace" : "Teammate workspace"}</span></div></section>
      <div className="workspace-grid-2">
        <section className="card workspace-panel"><div className="workspace-panel-header"><div><h2 className="workspace-panel-title">Readiness</h2><p className="workspace-panel-copy">A clear view of what is complete and what needs attention.</p></div><Link className="btn-ghost" href={`/projects/${submissionId}/submission`}>View submission →</Link></div><div className="workspace-checklist">{context.readiness.items.slice(0, 7).map((item) => <div className={`workspace-check${item.complete ? " is-complete" : ""}`} key={item.key}><span className="workspace-check-mark" aria-hidden="true">{item.complete ? "✓" : "!"}</span><span className="workspace-check-label">{item.label}</span><span className={`badge ${item.complete ? "badge-success" : "badge-warning"}`} style={{ marginLeft: "auto" }}>{item.complete ? "Complete" : "Needs attention"}</span></div>)}</div></section>
        <section className="card workspace-panel"><div className="workspace-panel-header"><div><h2 className="workspace-panel-title">Next actions</h2><p className="workspace-panel-copy">The shortest path to your next useful step.</p></div></div><div className="workspace-actions">{owner && <a className="btn-primary" href={`/api/submissions/owned/${encodeURIComponent(submissionId)}/edit`}>Continue editing</a>}<Link className="btn-secondary" href={`/projects/${submissionId}/team`}>{owner ? "Invite teammates" : "Review team"}</Link>{chatEnabled && <Link className="btn-secondary" href={`/projects/${submissionId}/messages`}>Open Team Chat</Link>}<Link className="btn-secondary" href={`/projects/${submissionId}/preview`}>Review preview</Link></div><p className="workspace-panel-copy" style={{ marginTop: "1rem" }}>{owner ? "As team lead, you control project editing and teammate access." : "As a teammate, you can review the project and collaborate in its private workspace."}</p></section>
      </div>
      <div className="workspace-grid-2">
        <section className="card workspace-panel"><div className="workspace-panel-header"><div><h2 className="workspace-panel-title">Recent activity</h2><p className="workspace-panel-copy">Meaningful project changes, not implementation details.</p></div><Link href={`/projects/${submissionId}/activity`} className="btn-ghost">View all →</Link></div>{context.activity.length === 0 ? <div className="workspace-empty"><h3>Project activity will appear here</h3><p>As your team works, important project milestones will collect here.</p></div> : <div className="workspace-activity-list">{context.activity.slice(0, 4).map((item) => <div className="workspace-activity-item" key={item.id}><span className="workspace-activity-dot" aria-hidden="true" /><span className="workspace-activity-label">{item.label}</span><time className="workspace-activity-time" dateTime={item.occurredAt.toISOString()}>{item.occurredAt.toLocaleDateString()}</time></div>)}</div>}</section>
        <section className="card workspace-panel"><div className="workspace-panel-header"><div><h2 className="workspace-panel-title">Team Chat</h2><p className="workspace-panel-copy">Private conversation with your project team.</p></div>{chatEnabled && <Link href={`/projects/${submissionId}/messages`} className="btn-ghost">Open →</Link>}</div>{!chatEnabled ? <div className="workspace-empty"><h3>Team Chat is not enabled yet</h3><p>This project workspace is ready. Team Chat will appear here when the project is included in the limited rollout.</p></div> : recentMessages.length === 0 ? <div className="workspace-empty"><h3>No team messages yet</h3><p>Introduce yourself or ask your teammates a question.</p></div> : <div className="workspace-message-preview">{recentMessages.map((message: RecentChatMessage) => <div className="workspace-message-row" key={message.message.id}><div><span className="workspace-message-author">{message.message.messageType === "system_event" ? "Vibe Hackathon" : message.author?.name || "Team member"}</span><p className="workspace-message-body">{message.message.deletedAt ? "Message deleted" : message.message.body}</p></div><time className="workspace-message-time" dateTime={message.message.createdAt.toISOString()}>{message.message.createdAt.toLocaleDateString()}</time></div>)}</div>}</section>
      </div>
    </div>
  </SubmissionWorkspaceShell>;
}
