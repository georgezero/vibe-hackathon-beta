"use client";

import { useMemo, useState } from "react";
import { InvitationLinkDialog } from "@/components/InvitationLinkDialog";
import { invitationExpiryLabel } from "@/lib/team-formation";

type RosterMember = { id: string; name: string; email: string | null };
type Invitation = { id: string; status: "pending" | "accepted" | "revoked" | "expired"; expiresAt: string; intendedMemberId: string | null };
type Membership = { id: string; role: "owner" | "teammate"; status: "invited" | "active" | "revoked"; name: string; email: string };

export function WorkspaceTeamClient({ submissionId, roster, invitations: initialInvitations, memberships: initialMemberships, canManage }: { submissionId: string; roster: RosterMember[]; invitations: Invitation[]; memberships: Membership[]; canManage: boolean }) {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [invitations, setInvitations] = useState(initialInvitations);
  const [membershipRows, setMembershipRows] = useState(initialMemberships);
  const teammateNames = useMemo(() => new Map(roster.map((member) => [member.id, member.name])), [roster]);
  const listedTeammates = roster.slice(1);

  async function revokeInvitation(id: string) {
    setBusy(true); setError(""); setMessage("");
    const response = await fetch(`/api/submission-memberships/invitations/${encodeURIComponent(id)}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ submissionId }) });
    const body = await response.json().catch(() => ({})) as { error?: string };
    setBusy(false);
    if (!response.ok) { setError(body.error ?? "The invitation could not be revoked."); return; }
    setInvitations((rows) => rows.map((row) => row.id === id ? { ...row, status: "revoked" as const } : row));
    setMessage("Invitation revoked. It will no longer work.");
  }

  async function revokeMembership(id: string) {
    setBusy(true); setError(""); setMessage("");
    const response = await fetch(`/api/submission-memberships/${encodeURIComponent(id)}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ submissionId }) });
    const body = await response.json().catch(() => ({})) as { error?: string };
    setBusy(false);
    if (!response.ok) { setError(body.error ?? "The membership change could not be completed."); return; }
    setMembershipRows((rows) => rows.map((row) => row.id === id ? { ...row, status: "revoked" as const } : row));
    setMessage("Project access revoked. The person remains listed on the team until the roster is updated.");
  }

  return <div style={{ display: "grid", gap: "1.25rem" }}>
    <section className="card workspace-panel">
      <div className="workspace-panel-header"><div><h2 className="workspace-panel-title">Invite teammates</h2><p className="workspace-panel-copy">Add a listed teammate to the private project workspace with a private, expiring invitation link.</p></div>{canManage ? <button type="button" className="btn-primary" onClick={() => { setError(""); setMessage(""); setInviteOpen(true); }}>Invite teammate</button> : <span className="badge badge-default">Team lead only</span>}</div>
      {!canManage && <p className="invitation-note">Only the Team lead can create or manage project-access links. If you started as a guest, save the project to My Projects and sign in as the Team lead first.</p>}
      {message && <p role="status" className="team-success-note" style={{ marginTop: ".8rem", marginBottom: 0 }}>{message}</p>}
      {error && <p role="alert" className="badge badge-error" style={{ marginTop: ".8rem" }}>{error}</p>}
    </section>

    {canManage && <section className="card workspace-panel"><div className="workspace-panel-header"><div><h2 className="workspace-panel-title">Invitation history</h2><p className="workspace-panel-copy">Links are claim-on-accept: the teammate chooses which signed-in account receives access.</p></div></div><div style={{ display: "grid", gap: ".1rem", marginTop: ".7rem" }}>{invitations.length === 0 ? <p className="workspace-panel-copy">No invitation links yet.</p> : invitations.map((invitation) => <div className="team-state-row" key={invitation.id}><div className="team-state-copy"><span className="team-state-name">{invitation.intendedMemberId ? teammateNames.get(invitation.intendedMemberId) ?? "Listed teammate" : "Unlinked teammate invitation"}</span><span className="team-state-meta">{invitation.status === "pending" ? invitationExpiryLabel(new Date(invitation.expiresAt)) : invitation.status === "accepted" ? "Accepted" : invitation.status === "expired" ? "Expired — create a new link" : "Revoked — create a new link"}</span></div><div className="team-state-actions"><span className={`badge ${invitation.status === "pending" ? "badge-default" : invitation.status === "accepted" ? "badge-success" : "badge-warning"}`}>{invitation.status === "pending" ? "Invite pending" : invitation.status[0].toUpperCase() + invitation.status.slice(1)}</span>{invitation.status === "pending" && <button className="btn-ghost" type="button" onClick={() => void revokeInvitation(invitation.id)} disabled={busy}>Revoke</button>}</div></div>)}</div></section>}

    <section className="card workspace-panel"><div className="workspace-panel-header"><div><h2 className="workspace-panel-title">Project access</h2><p className="workspace-panel-copy">Only accounts that accept an invitation can open the private workspace or Team Chat. Access and the listed team are tracked separately.</p></div></div><div style={{ display: "grid", gap: ".1rem", marginTop: ".7rem" }}>{membershipRows.filter((row) => row.role === "teammate").length === 0 ? <p className="workspace-panel-copy">No teammates have joined the private workspace yet.</p> : membershipRows.filter((row) => row.role === "teammate").map((row) => <div className="team-state-row" key={row.id}><div className="team-state-copy"><span className="team-state-name">{row.name}</span><span className="team-state-meta">{row.status === "active" ? "Can open the project and Team Chat" : "Cannot open the private workspace"}</span></div><div className="team-state-actions"><span className={`badge ${row.status === "active" ? "badge-success" : "badge-warning"}`}>{row.status === "active" ? "Access active" : "Access revoked"}</span>{canManage && row.status === "active" && <button className="btn-ghost" type="button" onClick={() => void revokeMembership(row.id)} disabled={busy}>Revoke access</button>}</div></div>)}</div></section>
    <InvitationLinkDialog open={inviteOpen} onClose={() => setInviteOpen(false)} submissionId={submissionId} roster={listedTeammates.map((member) => ({ id: member.id, name: member.name }))} onCreated={(invitation) => { setInvitations((rows) => [{ id: invitation.id, status: "pending", expiresAt: invitation.expiresAt, intendedMemberId: invitation.intendedMemberId }, ...rows]); }} />
  </div>;
}
