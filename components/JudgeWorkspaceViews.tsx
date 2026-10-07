import Link from "next/link";
import type { JudgeWorkspace } from "@/lib/judge-workspace";
import { readinessStatusLabel } from "@/lib/submission-workspace";
import { WorkspaceStat } from "@/components/SubmissionWorkspaceShell";

type ViewProps = { workspace: JudgeWorkspace };

export function JudgeWorkspaceOverview({ workspace }: ViewProps) {
  const { context, score } = workspace;
  const sub = context.submission;
  return <div className="workspace-page">
    <section className="workspace-hero">
      <div>
        <span className="badge badge-default">Assigned project</span>
        <h2>{sub.problemStatement || "Project overview"}</h2>
        <p>{sub.targetUsers || "Review the project context, artifacts, and submission history before entering your evaluation."}</p>
      </div>
      <div className="workspace-status-stack">
        <span className={`badge ${sub.status === "draft" ? "badge-warning" : "badge-success"}`}>{sub.status === "draft" ? "Draft" : "Finalized"}</span>
        <span className={`badge ${score?.completed ? "badge-success" : "badge-warning"}`}>{score?.completed ? "Evaluation complete" : "Evaluation pending"}</span>
      </div>
    </section>
    <div className="workspace-grid-2">
      <section className="card workspace-panel">
        <div className="workspace-panel-header"><div><h2 className="workspace-panel-title">Project snapshot</h2><p className="workspace-panel-copy">The team’s submitted context, kept separate from your scorecard.</p></div></div>
        <div className="workspace-stat-list">
          <WorkspaceStat label="Team" value={sub.teamName} />
          <WorkspaceStat label="Institution" value={context.members[0]?.affiliation || "Not provided"} />
          <WorkspaceStat label="Assignment" value="Assigned to you" tone="success" />
          <WorkspaceStat label="Submission" value={sub.status === "draft" ? "Draft" : "Finalized"} />
        </div>
        <div className="workspace-actions"><Link className="btn-primary" href={`/judge/projects/${encodeURIComponent(sub.id)}/evaluation`}>{score?.completed ? "Continue evaluation" : "Begin evaluation"}</Link><Link className="btn-secondary" href={`/judge/projects/${encodeURIComponent(sub.id)}/preview`}>Open preview</Link></div>
      </section>
      <section className="card workspace-panel">
        <div className="workspace-panel-header"><div><h2 className="workspace-panel-title">Submission signals</h2><p className="workspace-panel-copy">Readiness is derived from the existing submission validation.</p></div></div>
        <div className="workspace-checklist">{context.readiness.items.slice(0, 7).map((item) => <div className={`workspace-check${item.complete ? " is-complete" : ""}`} key={item.key}><span className="workspace-check-mark" aria-hidden="true">{item.complete ? "✓" : "!"}</span><span className="workspace-check-label">{item.label}</span><span className={`badge ${item.complete ? "badge-success" : "badge-warning"}`} style={{ marginLeft: "auto" }}>{item.complete ? "Complete" : "Needs attention"}</span></div>)}</div>
      </section>
    </div>
    <section className="card workspace-panel">
      <div className="workspace-panel-header"><div><h2 className="workspace-panel-title">Recent project activity</h2><p className="workspace-panel-copy">Participant-visible milestones only. Private conversation and internal audit events stay out of this view.</p></div><Link className="btn-ghost" href={`/judge/projects/${encodeURIComponent(sub.id)}/activity`}>View activity →</Link></div>
      {context.activity.length === 0 ? <div className="workspace-empty"><h3>No project activity yet</h3><p>The timeline will fill as the team works on the submission.</p></div> : <div className="workspace-activity-list">{context.activity.slice(0, 4).map((item) => <div className="workspace-activity-item" key={item.id}><span className="workspace-activity-dot" aria-hidden="true" /><span className="workspace-activity-label">{item.label}</span><time className="workspace-activity-time" dateTime={item.occurredAt.toISOString()}>{item.occurredAt.toLocaleDateString()}</time></div>)}</div>}
    </section>
  </div>;
}

export function JudgeWorkspaceTeam({ workspace }: ViewProps) {
  const { context } = workspace;
  return <div className="workspace-page">
    <section className="workspace-hero"><div><span className="badge badge-default">Read-only</span><h2>Project team</h2><p>Roster and badge-completion context are visible for review. Account and invitation controls remain private to the team.</p></div><div className="workspace-status-stack"><span className="badge badge-default">{context.members.length} roster members</span><span className="badge badge-default">{context.memberships.filter((row) => row.membership.status === "active").length} joined accounts</span></div></section>
    <section className="card workspace-panel"><div className="workspace-panel-header"><div><h2 className="workspace-panel-title">Formal roster</h2><p className="workspace-panel-copy">Badge status is shown as completion only; badge numbers and contact details are never exposed here.</p></div></div><div className="workspace-member-grid">{context.members.map((member, index) => <div className="workspace-member" key={member.id}><span className="workspace-avatar" aria-hidden="true">{member.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</span><div style={{ minWidth: 0, flex: 1 }}><p className="workspace-member-name">{member.name}</p><p className="workspace-member-meta">{member.affiliation || "Team member"}{member.degrees ? ` · ${member.degrees}` : ""}</p><div className="flex flex-wrap gap-2" style={{ marginTop: "0.45rem" }}><span className="badge badge-default">{index === 0 ? "Owner" : "Teammate"}</span><span className={`badge ${member.badgeNumber ? "badge-success" : "badge-warning"}`}>{member.badgeNumber ? "Badge complete" : "Badge pending"}</span></div></div></div>)}</div></section>
    <section className="card workspace-panel"><div className="workspace-panel-header"><div><h2 className="workspace-panel-title">Workspace accounts</h2><p className="workspace-panel-copy">Only explicit project membership creates account access; roster email matches do not.</p></div></div><div className="workspace-member-grid">{context.memberships.filter((row) => row.membership.status === "active").map((row) => <div className="workspace-member" key={row.membership.id}><span className="workspace-avatar" aria-hidden="true">{(row.user.name?.trim() || "Member").split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</span><div><p className="workspace-member-name">{row.user.name?.trim() || "Team member"}</p><p className="workspace-member-meta">{row.membership.role === "owner" ? "Owner" : "Teammate"} · active membership</p></div></div>)}</div></section>
  </div>;
}

export function JudgeWorkspaceActivity({ workspace }: ViewProps) {
  const grouped = new Map<string, typeof workspace.context.activity>();
  for (const item of workspace.context.activity) {
    const day = item.occurredAt.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
    grouped.set(day, [...(grouped.get(day) ?? []), item]);
  }
  return <section className="card workspace-panel"><div className="workspace-panel-header"><div><span className="badge badge-default">Read-only</span><h2 className="workspace-panel-title" style={{ marginTop: "0.55rem" }}>Project activity</h2><p className="workspace-panel-copy">Participant-visible project history, not authentication, authorization, or chat audit data.</p></div><span className="badge badge-default">Team-visible</span></div>{workspace.context.activity.length === 0 ? <div className="workspace-empty"><h3>No project activity yet</h3><p>The timeline will appear as the team moves the project forward.</p></div> : <div className="workspace-timeline">{[...grouped.entries()].map(([day, entries]) => <div key={day}><div className="workspace-timeline-day">{day}</div><div className="workspace-timeline-group">{entries.map((item) => <article className="workspace-timeline-entry" key={item.id}><p className="workspace-timeline-label">{item.label}</p><time className="workspace-timeline-time" dateTime={item.occurredAt.toISOString()}>{item.occurredAt.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</time></article>)}</div></div>)}</div>}</section>;
}

export function JudgeWorkspacePreview({ workspace }: ViewProps) {
  const sub = workspace.context.submission;
  return <div className="workspace-page"><section className="workspace-hero"><div><span className="badge badge-default">Judge preview</span><h2>{sub.projectTitle || "Untitled project"}</h2><p>This uses the same core project and team fields participants review before submitting. Private chat, participant profile data, and judging notes stay out of the preview.</p></div><Link className="btn-secondary" href={`/judge/projects/${encodeURIComponent(sub.id)}/submission`}>Review submission</Link></section><section className="card workspace-panel"><div className="workspace-panel-header"><div><h2 className="workspace-panel-title">Project details</h2><p className="workspace-panel-copy">Links open the current hosted artifacts that the submitted project points to.</p></div></div><dl className="workspace-stat-list"><PreviewField label="Problem" value={sub.problemStatement} /><PreviewField label="Target users" value={sub.targetUsers} /><PreviewField label="Repository" value={sub.githubUrl} link /><PreviewField label="Demo" value={sub.demoUrl} link /><PreviewField label="License" value={sub.license} /></dl></section><section className="card workspace-panel"><div className="workspace-panel-header"><div><h2 className="workspace-panel-title">Team preview</h2><p className="workspace-panel-copy">Participant-safe roster details.</p></div></div><div className="workspace-member-grid">{workspace.context.members.map((member) => <div className="workspace-member" key={member.id}><span className="workspace-avatar" aria-hidden="true">{member.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</span><div><p className="workspace-member-name">{member.name}</p><p className="workspace-member-meta">{member.affiliation || "Team member"}</p></div></div>)}</div></section></div>;
}

export function JudgeWorkspaceSubmission({ workspace }: ViewProps) {
  const { context } = workspace;
  const sub = context.submission;
  return <div className="workspace-page"><section className="workspace-hero"><div><span className="badge badge-default">Read-only</span><h2>Submission</h2><p>Eligibility, project completion, and judging state are intentionally shown as separate signals.</p></div><span className={`badge ${context.readiness.status === "ready" || context.readiness.status === "finalized" ? "badge-success" : "badge-warning"}`}>{readinessStatusLabel(context.readiness.status)}</span></section><div className="workspace-grid-3"><div className="card workspace-panel"><h2 className="workspace-panel-title">Project completion</h2><p className="workspace-stat-value">{context.readiness.completionPercent}%</p><p className="workspace-panel-copy">Existing readiness validation.</p></div><div className="card workspace-panel"><h2 className="workspace-panel-title">Submission state</h2><p className="workspace-stat-value">{sub.status === "draft" ? "Draft" : "Finalized"}</p><p className="workspace-panel-copy">Teams control finalization.</p></div><div className="card workspace-panel"><h2 className="workspace-panel-title">Assignment</h2><p className="workspace-stat-value">Assigned</p><p className="workspace-panel-copy">You are assigned to this project.</p></div></div><section className="card workspace-panel"><div className="workspace-panel-header"><div><h2 className="workspace-panel-title">Readiness checklist</h2><p className="workspace-panel-copy">Required assets and team details from the existing validation.</p></div></div><div className="workspace-checklist">{context.readiness.items.map((item) => <div className={`workspace-check ${item.complete ? "is-complete" : ""}`} key={item.key}><span className="workspace-check-mark" aria-hidden="true">{item.complete ? "✓" : "!"}</span><span className="workspace-check-label">{item.label}</span><span className={`badge ${item.complete ? "badge-success" : "badge-warning"}`}>{item.complete ? "Complete" : "Needs attention"}</span></div>)}</div></section><section className="card workspace-panel"><WorkspaceStat label="Judging state" value={sub.status === "draft" ? "Awaiting finalization" : "Under review"} /><WorkspaceStat label="Evaluation" value={workspace.score?.completed ? "Complete" : "Pending"} tone={workspace.score?.completed ? "success" : "warning"} /><WorkspaceStat label="Deadline" value={context.deadline.label} /></section></div>;
}

function PreviewField({ label, value, link }: { label: string; value: string | null; link?: boolean }) {
  return <div><dt style={{ color: "var(--color-subtle)", fontSize: "0.73rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</dt><dd style={{ color: value ? "var(--color-fg)" : "var(--color-subtle)", marginTop: "0.2rem", lineHeight: 1.55 }}>{value ? link ? <a href={value} target="_blank" rel="noreferrer" style={{ color: "var(--color-accent)" }}>{value}</a> : value : "Not provided yet"}</dd></div>;
}
