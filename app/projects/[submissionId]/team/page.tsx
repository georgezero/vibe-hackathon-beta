import { headers } from "next/headers";
import { SubmissionWorkspaceShell } from "@/components/SubmissionWorkspaceShell";
import { WorkspaceAccessState } from "@/components/WorkspaceAccessState";
import { WorkspaceTeamClient } from "./WorkspaceTeamClient";
import { resolveSubmissionWorkspace } from "@/lib/submission-workspace";
import { projectTeamFormation, teammateStateLabel, teammateStateTone } from "@/lib/team-formation";

export const dynamic = "force-dynamic";

export default async function WorkspaceTeamPage({ params }: { params: Promise<{ submissionId: string }> }) {
  const { submissionId } = await params;
  const resolution = await resolveSubmissionWorkspace(submissionId, await headers());
  if (resolution.status !== "ok") return <WorkspaceAccessState status={resolution.status} submissionId={submissionId} />;
  const { context, principal } = resolution;
  const teamFormation = projectTeamFormation({
    members: context.members.map((member) => ({ id: member.id, name: member.name, affiliation: member.affiliation, order: member.order })),
    invitations: context.invitations.map((invitation) => ({ id: invitation.id, status: invitation.status, expiresAt: invitation.expiresAt, intendedMemberId: invitation.intendedMemberId })),
    memberships: context.memberships.map((row) => ({ id: row.membership.id, userId: row.user.id, role: row.membership.role, status: row.membership.status, invitationId: row.membership.invitationId, name: row.user.name?.trim() || "Team member" })),
  });
  return <SubmissionWorkspaceShell context={context} principal={principal} currentTab="team">
    <div className="workspace-page">
      <section className="workspace-hero"><div><h2>Your team</h2><p>See who is listed on the project and who has joined the private workspace. Team listing and project access are separate.</p></div><div className="workspace-status-stack"><span className="badge badge-default">{teamFormation.teamSize} people listed</span><span className="badge badge-success">{teamFormation.activeAccessCount} with project access</span></div></section>
      <section className="card workspace-panel"><div className="workspace-panel-header"><div><h2 className="workspace-panel-title">Team lead</h2><p className="workspace-panel-copy">The Team lead started this project and controls invitations and team details.</p></div></div>{teamFormation.teamLead ? <TeamMemberCard member={teamFormation.teamLead} label="Team lead" stateLabel="Project access active" stateTone="success" /> : <p className="workspace-panel-copy">No team lead is listed.</p>}</section>
      <section className="card workspace-panel"><div className="workspace-panel-header"><div><h2 className="workspace-panel-title">Teammates</h2><p className="workspace-panel-copy">Teammates are listed on the project. A teammate gets private project access after accepting an invitation while signed in.</p></div></div>{teamFormation.teammates.length === 0 ? <p className="workspace-panel-copy">No teammates are listed yet.</p> : <div className="workspace-member-grid">{teamFormation.teammates.map((member) => <TeamMemberCard key={member.id} member={member} label="Teammate" stateLabel={teammateStateLabel(member.state)} stateTone={teammateStateTone(member.state)} />)}</div>}<p className="workspace-panel-copy" style={{ marginTop: "1rem" }}>Team eligibility is separate from project access. Missing badge details can affect prize eligibility without changing who can collaborate.</p></section>
      <WorkspaceTeamClient submissionId={submissionId} canManage={context.membership.role === "owner"} roster={context.members.map((member) => ({ id: member.id, name: member.name, email: member.email }))} invitations={context.invitations.map((invitation) => ({ id: invitation.id, status: invitation.status, expiresAt: invitation.expiresAt.toISOString(), intendedMemberId: invitation.intendedMemberId }))} memberships={context.memberships.map((row) => ({ id: row.membership.id, role: row.membership.role, status: row.membership.status, name: row.user.name?.trim() || row.user.email, email: row.user.email }))} />
      <section className="card workspace-panel"><div className="workspace-panel-header"><div><h2 className="workspace-panel-title">About project access</h2><p className="workspace-panel-copy">Joining this private project workspace does not change event or judging access. Teammates must accept an invitation before they can collaborate here.</p></div></div></section>
    </div>
  </SubmissionWorkspaceShell>;
}

function TeamMemberCard({ member, label, stateLabel, stateTone }: { member: { id: string; name: string; affiliation?: string | null }; label: string; stateLabel: string; stateTone: "success" | "warning" | "default" }) {
  return <div className="workspace-member"><span className="workspace-avatar" aria-hidden="true">{member.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</span><div style={{ minWidth: 0, flex: 1 }}><p className="workspace-member-name">{member.name}</p><p className="workspace-member-meta">{member.affiliation || "Team member"}</p><div className="flex flex-wrap gap-2" style={{ marginTop: "0.45rem" }}><span className="badge badge-default">{label}</span><span className={`badge badge-${stateTone}`}>{stateLabel}</span></div></div></div>;
}
