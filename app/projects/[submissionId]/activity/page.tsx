import { headers } from "next/headers";
import { SubmissionWorkspaceShell } from "@/components/SubmissionWorkspaceShell";
import { WorkspaceAccessState } from "@/components/WorkspaceAccessState";
import { resolveSubmissionWorkspace } from "@/lib/submission-workspace";

export const dynamic = "force-dynamic";

export default async function WorkspaceActivityPage({ params }: { params: Promise<{ submissionId: string }> }) {
  const { submissionId } = await params;
  const resolution = await resolveSubmissionWorkspace(submissionId, await headers());
  if (resolution.status !== "ok") return <WorkspaceAccessState status={resolution.status} submissionId={submissionId} />;
  const { context, principal } = resolution;
  const grouped = new Map<string, typeof context.activity>();
  for (const item of context.activity) {
    const day = item.occurredAt.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
    grouped.set(day, [...(grouped.get(day) ?? []), item]);
  }
  return <SubmissionWorkspaceShell context={context} principal={principal} currentTab="activity">
    <section className="card workspace-panel"><div className="workspace-panel-header"><div><h2 className="workspace-panel-title">Project activity</h2><p className="workspace-panel-copy">A calm timeline of the moments that move this project forward. Team Chat stays separate.</p></div><span className="badge badge-default">Team-visible</span></div>{context.activity.length === 0 ? <div className="workspace-empty"><h3>Project activity will appear here</h3><p>As your team works, important project milestones will collect here.</p></div> : <div className="workspace-timeline">{[...grouped.entries()].map(([day, entries]) => <div key={day}><div className="workspace-timeline-day">{day}</div><div className="workspace-timeline-group">{entries.map((item) => <article className="workspace-timeline-entry" key={item.id}><div><p className="workspace-timeline-label">{item.label}</p></div><time className="workspace-timeline-time" dateTime={item.occurredAt.toISOString()}>{item.occurredAt.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</time></article>)}</div></div>)}</div>}</section>
  </SubmissionWorkspaceShell>;
}
