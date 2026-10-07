import { headers } from "next/headers";
import { SubmissionWorkspaceShell, WorkspaceStat } from "@/components/SubmissionWorkspaceShell";
import { WorkspaceAccessState } from "@/components/WorkspaceAccessState";
import { readinessStatusLabel, resolveSubmissionWorkspace } from "@/lib/submission-workspace";

export const dynamic = "force-dynamic";

async function WorkspaceStatusPage({ params }: { params: Promise<{ submissionId: string }> }) {
  const { submissionId } = await params;
  const resolution = await resolveSubmissionWorkspace(submissionId, await headers());
  if (resolution.status !== "ok") return <WorkspaceAccessState status={resolution.status} submissionId={submissionId} />;
  const { context, principal } = resolution;
  const readiness = context.readiness;
  return <SubmissionWorkspaceShell context={context} principal={principal} currentTab="submission">
    <div className="workspace-page">
      <section className="workspace-hero"><div><h2>Submission status</h2><p>Completion, eligibility, and judging state are tracked separately.</p></div><span className={`badge ${readiness.status === "ready" || readiness.status === "finalized" ? "badge-success" : "badge-warning"}`}>{readinessStatusLabel(readiness.status)}</span></section>
      <section className="workspace-grid-3"><div className="card workspace-panel"><h2 className="workspace-panel-title">Project completeness</h2><p className="workspace-stat-value">{readiness.completionPercent}%</p><p className="workspace-panel-copy">Required project details only. Prize eligibility is shown separately.</p></div><div className="card workspace-panel"><h2 className="workspace-panel-title">Submission</h2><p className="workspace-stat-value">{context.submission.status === "draft" ? "Draft" : "Submitted"}</p><p className="workspace-panel-copy">{context.eventFrozen ? "Project changes are currently closed because the event is frozen." : "Submitting marks this version for judging. Updates remain possible before the deadline."}</p></div><div className="card workspace-panel"><h2 className="workspace-panel-title">Deadline</h2><p className="workspace-stat-value">{context.deadline.label}</p><p className="workspace-panel-copy">The event schedule controls when edits and submission close.</p></div></section>
      <section className="card workspace-panel"><div className="workspace-panel-header"><div><h2 className="workspace-panel-title">Required project details</h2><p className="workspace-panel-copy">These are the details that must be complete before submitting for judging.</p></div></div><div className="workspace-checklist">{readiness.requiredItems.map((item) => <div className={`workspace-check ${item.complete ? "is-complete" : ""}`} key={item.key}><span className="workspace-check-mark" aria-hidden="true">{item.complete ? "✓" : "!"}</span><span className="workspace-check-label">{item.label}</span><span className={`badge ${item.complete ? "badge-success" : "badge-warning"}`}>{item.complete ? "Complete" : "Needs attention"}</span></div>)}</div></section>
      <section className="card workspace-panel"><div className="workspace-panel-header"><div><h2 className="workspace-panel-title">Prize eligibility</h2><p className="workspace-panel-copy">Badge completeness affects prize eligibility, not whether the project details are complete.</p></div><span className={`badge ${readiness.teamEligibility.eligibleForPrize ? "badge-success" : "badge-warning"}`}>{readiness.teamEligibility.eligibleForPrize ? "Eligible" : "Needs attention"}</span></div><p className="workspace-panel-copy">{readiness.teamEligibility.eligibleForPrize ? `${readiness.teamEligibility.badgeCount} of ${readiness.teamEligibility.memberCount} badge numbers are on file.` : `Add badge numbers for ${readiness.teamEligibility.missingMembers.join(", ")} before the event's prize-eligibility cutoff.`}</p></section>
      <section className="card workspace-panel"><div className="workspace-panel-header"><div><h2 className="workspace-panel-title">Judging</h2><p className="workspace-panel-copy">After you submit, organizers and assigned judges review the project. Project access does not grant judge access.</p></div></div><WorkspaceStat label="Current judging state" value={context.submission.status === "draft" ? "Not submitted" : "Under review"} /></section>
    </div>
  </SubmissionWorkspaceShell>;
}

export default WorkspaceStatusPage;
