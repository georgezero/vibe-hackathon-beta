import Link from "next/link";
import { headers } from "next/headers";
import { SubmissionWorkspaceShell } from "@/components/SubmissionWorkspaceShell";
import { WorkspaceAccessState } from "@/components/WorkspaceAccessState";
import { resolveSubmissionWorkspace } from "@/lib/submission-workspace";

export const dynamic = "force-dynamic";

export default async function WorkspacePreviewPage({ params }: { params: Promise<{ submissionId: string }> }) {
  const { submissionId } = await params;
  const resolution = await resolveSubmissionWorkspace(submissionId, await headers());
  if (resolution.status !== "ok") return <WorkspaceAccessState status={resolution.status} submissionId={submissionId} />;
  const { context, principal } = resolution;
  const sub = context.submission;
  return <SubmissionWorkspaceShell context={context} principal={principal} currentTab="preview">
    <div className="workspace-page">
      <section className="workspace-hero"><div><div className="flex flex-wrap gap-2"><span className={`badge ${sub.status === "draft" ? "badge-warning" : "badge-success"}`}>{sub.status === "draft" ? "Draft" : "Submitted"}</span><span className="badge badge-default">Workspace preview</span></div><h2>{sub.projectTitle || "Untitled project"}</h2><p>by <strong>{sub.teamName}</strong></p><p>This is the project view shared with the team. The assigned judge preview uses the same core project and team fields.</p></div><Link className="btn-secondary" href={`/projects/${submissionId}/submission`}>Review submission</Link></section>
      <section className="card workspace-panel"><div className="workspace-panel-header"><div><h2 className="workspace-panel-title">Project details</h2><p className="workspace-panel-copy">This preview uses the current hosted project state.</p></div></div><dl className="workspace-stat-list"><PreviewField label="Problem" value={sub.problemStatement} /><PreviewField label="Target users" value={sub.targetUsers} /><PreviewField label="Repository" value={sub.githubUrl} link /><PreviewField label="Demo" value={sub.demoUrl} link /><PreviewField label="License" value={sub.license} /></dl><p className="workspace-panel-copy" style={{ marginTop: "1rem" }}>Private recovery remains available separately for the team lead.</p></section>
      <section className="card workspace-panel"><div className="workspace-panel-header"><div><h2 className="workspace-panel-title">Team information</h2><p className="workspace-panel-copy">A read-only view of the team submitted for this project.</p></div></div><div className="workspace-member-grid">{context.members.map((member) => <div className="workspace-member" key={member.id}><span className="workspace-avatar" aria-hidden="true">{member.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</span><div><p className="workspace-member-name">{member.name}</p><p className="workspace-member-meta">{member.affiliation || "Team member"}</p></div></div>)}</div></section>
    </div>
  </SubmissionWorkspaceShell>;
}

function PreviewField({ label, value, link }: { label: string; value: string | null; link?: boolean }) {
  return <div><dt style={{ color: "var(--color-subtle)", fontSize: "0.73rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</dt><dd style={{ color: value ? "var(--color-fg)" : "var(--color-subtle)", marginTop: "0.2rem", lineHeight: 1.55 }}>{value ? link ? <a href={value} target="_blank" rel="noreferrer" style={{ color: "var(--color-accent)" }}>{value}</a> : value : "Not provided yet"}</dd></div>;
}
