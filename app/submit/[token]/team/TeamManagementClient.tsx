"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { computePrizeEligibility } from "@/lib/prize-eligibility";
import { TeamSummaryCard } from "@/components/TeamSummaryCard";
import { InvitationLinkDialog } from "@/components/InvitationLinkDialog";
import { invitationExpiryLabel } from "@/lib/team-formation";

export type EditableMember = {
  id?: string;
  name: string;
  email: string;
  badgeNumber: string;
  affiliation: string;
  degrees: string;
  isStudentTrainee: boolean;
};

export function TeamManagementClient({
  token,
  submissionId,
  teamName: initialTeamName,
  owner: initialOwner,
  members: initialMembers,
  canManageMemberships,
  memberships: initialMemberships,
  invitations: initialInvitations,
}: {
  token: string;
  submissionId: string;
  teamName: string;
  owner: EditableMember;
  members: EditableMember[];
  canManageMemberships: boolean;
  memberships: Array<{ id: string; role: "owner" | "teammate"; status: "invited" | "active" | "revoked"; name: string | null; email: string }>;
  invitations: Array<{ id: string; status: "pending" | "accepted" | "revoked" | "expired"; expiresAt: string; intendedMemberId: string | null }>;
}) {
  const router = useRouter();
  const [teamName, setTeamName] = useState(initialTeamName);
  const [owner, setOwner] = useState(initialOwner);
  const [members, setMembers] = useState(initialMembers);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [memberships, setMemberships] = useState(initialMemberships);
  const [invitations, setInvitations] = useState(initialInvitations);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [membershipBusy, setMembershipBusy] = useState(false);
  const summary = useMemo(() => computePrizeEligibility([owner, ...members]), [owner, members]);

  function updateMember(index: number, patch: Partial<EditableMember>) {
    setSaved(false);
    setMembers((rows) => rows.map((row, i) => i === index ? { ...row, ...patch } : row));
  }

  async function save() {
    setSaving(true);
    setError("");
    setSaved(false);
    const res = await fetch(`/api/v1/submissions/${submissionId}/team`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ teamName, owner, members }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Unable to save team.");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  async function revokeInvitation(id: string) {
    setMembershipBusy(true);
    setError("");
    const response = await fetch(`/api/submission-memberships/invitations/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ submissionId }),
    });
    const body = await response.json().catch(() => ({})) as { error?: string };
    setMembershipBusy(false);
    if (!response.ok) {
      setError(body.error ?? "Unable to revoke invitation.");
      return;
    }
    setInvitations((rows) => rows.map((row) => row.id === id ? { ...row, status: "revoked" as const } : row));
  }

  async function revokeMembership(id: string) {
    setMembershipBusy(true);
    setError("");
    const response = await fetch(`/api/submission-memberships/${encodeURIComponent(id)}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ submissionId }) });
    const body = await response.json().catch(() => ({})) as { error?: string };
    setMembershipBusy(false);
    if (!response.ok) {
      setError(body.error ?? "Unable to revoke teammate access.");
      return;
    }
    setMemberships((rows) => rows.map((row) => row.id === id ? { ...row, status: "revoked" as const } : row));
  }

  return (
    <div className="flex flex-col gap-6">
      <TeamSummaryCard token={token} summary={summary} />

      <div className="card" style={{ padding: "1.25rem" }}>
        <div className="flex items-start justify-between gap-3 flex-wrap" style={{ marginBottom: "1rem" }}>
          <div>
            <h2 style={{ color: "var(--color-fg)", fontWeight: 850, fontSize: "1.2rem" }}>Team lead</h2>
            <p style={{ color: "var(--color-muted)", fontSize: "0.8125rem", lineHeight: 1.5 }}>The team lead registered this project and cannot be removed.</p>
          </div>
          <span className="badge badge-default">Team lead</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Team name *"><input className="input" value={teamName} onChange={(e) => { setTeamName(e.target.value); setSaved(false); }} required /></Field>
          <Field label="Team lead name *"><input className="input" value={owner.name} onChange={(e) => setOwner({ ...owner, name: e.target.value })} required /></Field>
          <Field label="Team lead email *"><input className="input" type="email" value={owner.email} onChange={(e) => setOwner({ ...owner, email: e.target.value })} required /></Field>
          <Field label="Team lead badge number *"><input className="input" value={owner.badgeNumber} onChange={(e) => setOwner({ ...owner, badgeNumber: e.target.value })} required /></Field>
          <Field label="Affiliation / institution"><input className="input" value={owner.affiliation} onChange={(e) => setOwner({ ...owner, affiliation: e.target.value })} /></Field>
          <Field label="Degree(s)"><input className="input" value={owner.degrees} onChange={(e) => setOwner({ ...owner, degrees: e.target.value })} placeholder="MD, PhD, MS" /></Field>
        </div>
        <label style={{ display: "flex", gap: "0.55rem", alignItems: "center", color: "var(--color-muted)", fontSize: "0.875rem", marginTop: "1rem" }}>
          <input type="checkbox" checked={owner.isStudentTrainee} onChange={(e) => setOwner({ ...owner, isStudentTrainee: e.target.checked })} />
          Student / trainee
        </label>
      </div>

      {canManageMemberships && (
        <section className="card" style={{ padding: "1.25rem" }}>
          <div className="flex items-start justify-between gap-3 flex-wrap" style={{ marginBottom: "1rem" }}><div><h2 style={{ color: "var(--color-fg)", fontWeight: 850, fontSize: "1.2rem" }}>Invite teammates</h2><p style={{ color: "var(--color-muted)", fontSize: "0.8125rem", lineHeight: 1.55, marginTop: "0.35rem" }}>Create a private, expiring invitation link for someone already listed on your team.</p></div><button type="button" className="btn-primary" disabled={membershipBusy || members.length === 0} onClick={() => { setError(""); setInviteOpen(true); }}>Invite teammate</button></div>
          <p className="invitation-note">The link is private and claim-on-accept: your teammate chooses the signed-in account that receives project access. It does not grant judge or admin access.</p>
          <div style={{ display: "grid", gap: "0.5rem", marginTop: "1rem" }}>
            {memberships.filter((row) => row.role === "teammate").map((row) => <div key={row.id} className="team-state-row"><div className="team-state-copy"><span className="team-state-name">{row.name || "Teammate"}</span><span className="team-state-meta">{row.status === "active" ? "Can open the project and Team Chat" : "Project access revoked"}</span></div><div className="team-state-actions"><span className={`badge ${row.status === "active" ? "badge-success" : "badge-warning"}`}>{row.status === "active" ? "Access active" : "Access revoked"}</span>{row.status === "active" && <button type="button" className="btn-ghost" disabled={membershipBusy} onClick={() => revokeMembership(row.id)}>Revoke access</button>}</div></div>)}
            {!memberships.some((row) => row.role === "teammate") && <p style={{ color: "var(--color-subtle)", fontSize: "0.8rem" }}>No teammates have joined the private project yet.</p>}
          </div>
          <div style={{ display: "grid", gap: "0.5rem", marginTop: "1rem" }}>
            <h3 style={{ color: "var(--color-fg)", fontSize: "0.9rem", fontWeight: 750 }}>Pending invitations</h3>
            {invitations.filter((row) => row.status === "pending").map((row) => (
              <div key={row.id} style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", alignItems: "center", padding: "0.65rem 0", borderTop: "1px solid var(--color-border)" }}>
                <div><strong style={{ color: "var(--color-fg)", fontSize: "0.85rem" }}>Invitation link</strong><span style={{ display: "block", color: "var(--color-subtle)", fontSize: "0.72rem" }}>{invitationExpiryLabel(new Date(row.expiresAt))} · Send it only to the intended teammate.</span></div>
                <button type="button" className="btn-ghost" disabled={membershipBusy} onClick={() => revokeInvitation(row.id)}>Revoke invitation</button>
              </div>
            ))}
            {!invitations.some((row) => row.status === "pending") && <p style={{ color: "var(--color-subtle)", fontSize: "0.8rem" }}>No pending invitations.</p>}
          </div>
          <InvitationLinkDialog open={inviteOpen} onClose={() => setInviteOpen(false)} submissionId={submissionId} roster={members.filter((member): member is EditableMember & { id: string } => Boolean(member.id)).map((member) => ({ id: member.id, name: member.name }))} onCreated={(invitation) => { setInvitations((rows) => [{ id: invitation.id, status: "pending", expiresAt: invitation.expiresAt, intendedMemberId: invitation.intendedMemberId }, ...rows]); }} />
        </section>
      )}

      <div className="card" style={{ padding: "1.25rem" }}>
        <div className="flex items-start justify-between gap-3 flex-wrap" style={{ marginBottom: "1rem" }}>
          <div>
            <h2 style={{ color: "var(--color-fg)", fontWeight: 850, fontSize: "1.2rem" }}>Teammates</h2>
            <p style={{ color: "var(--color-muted)", fontSize: "0.8125rem", lineHeight: 1.5 }}>Your team can include up to 6 people. Teammate badge numbers are recommended for prize eligibility.</p>
            <p style={{ color: "var(--color-warning)", fontSize: "0.75rem", lineHeight: 1.5, marginTop: "0.35rem" }}>
              Saving replaces the current teammate list. Removing a listed row does not revoke existing project access; use Revoke access above when access should also end.
            </p>
          </div>
          <button
            type="button"
            className="btn-secondary"
            disabled={members.length >= 5}
            onClick={() => { setMembers((rows) => [...rows, { name: "", email: "", badgeNumber: "", affiliation: "", degrees: "", isStudentTrainee: false }]); setSaved(false); }}
          >
            Add teammate
          </button>
        </div>
        <div className="flex flex-col gap-3">
          {members.map((member, index) => (
            <div key={member.id ?? index} style={{ border: "1px solid var(--color-border)", background: "var(--color-surface-2)", borderRadius: 12, padding: "1rem" }}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Name *"><input className="input" value={member.name} onChange={(e) => updateMember(index, { name: e.target.value })} /></Field>
                <Field label="Email"><input className="input" type="email" value={member.email} onChange={(e) => updateMember(index, { email: e.target.value })} /></Field>
                <Field label="Badge number"><input className="input" value={member.badgeNumber} onChange={(e) => updateMember(index, { badgeNumber: e.target.value })} /></Field>
                <Field label="Affiliation / institution"><input className="input" value={member.affiliation} onChange={(e) => updateMember(index, { affiliation: e.target.value })} /></Field>
                <Field label="Degree(s)"><input className="input" value={member.degrees} onChange={(e) => updateMember(index, { degrees: e.target.value })} /></Field>
                <label style={{ display: "flex", gap: "0.55rem", alignItems: "center", color: "var(--color-muted)", fontSize: "0.875rem", paddingTop: "1.65rem" }}>
                  <input type="checkbox" checked={member.isStudentTrainee} onChange={(e) => updateMember(index, { isStudentTrainee: e.target.checked })} />
                  Student / trainee
                </label>
              </div>
              <button type="button" className="btn-ghost" style={{ marginTop: "0.75rem" }} onClick={() => { if (!window.confirm(`Remove ${member.name || "this teammate"} from the listed team? Existing project access will remain until it is revoked separately.`)) return; setMembers((rows) => rows.filter((_, i) => i !== index)); setSaved(false); }}>
                Remove teammate
              </button>
            </div>
          ))}
          {members.length === 0 && <p style={{ color: "var(--color-subtle)", fontSize: "0.875rem" }}>No teammates added yet.</p>}
        </div>
      </div>

      <div className="card" style={{ padding: "1rem", color: "var(--color-muted)", fontSize: "0.8125rem", lineHeight: 1.6 }}>
        <strong style={{ color: "var(--color-fg)" }}>Team eligibility:</strong> If your team is selected for an award, every team member needs a valid badge number and verification before prizes can be distributed.
      </div>

      {error && <div className="badge badge-error">{error}</div>}
      {saved && <div className="badge badge-success">Team saved</div>}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={save} disabled={saving || summary.memberCount > 6} className="btn-primary">{saving ? "Saving..." : "Save team"}</button>
        <Link href={`/submit/${token}/start`} className="btn-secondary">Back to start</Link>
        <Link href={`/submit/${token}/preview`} className="btn-secondary">Preview</Link>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="label">{label}</label>{children}</div>;
}
