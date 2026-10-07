/**
 * Participant-safe projection for the two deliberately separate team
 * concepts: the listed roster and authenticated project access.
 *
 * Invitations in the current domain are private, token-based, claim-on-accept
 * links. They may be prepared for a listed teammate, but they are not bound to
 * an account until the recipient accepts while signed in.
 */

export type ParticipantTeammateState =
  | "listed_on_team"
  | "invitation_ready"
  | "invitation_pending"
  | "invitation_expired"
  | "invitation_revoked"
  | "project_access_active"
  | "project_access_revoked";

export type TeamFormationMember = {
  id: string;
  name: string;
  affiliation?: string | null;
  order?: number | null;
  role?: string | null;
  state: ParticipantTeammateState;
  invitationId: string | null;
  invitationExpiresAt: Date | null;
  accessMembershipId: string | null;
};

export type TeamFormationAccess = {
  id: string;
  userId: string;
  name: string;
  role: "owner" | "teammate";
  status: "invited" | "active" | "revoked";
  invitationId: string | null;
};

type InvitationInput = {
  id: string;
  status: "pending" | "accepted" | "revoked" | "expired";
  expiresAt: Date;
  intendedMemberId: string | null;
};

type MembershipInput = {
  id: string;
  userId: string;
  role: "owner" | "teammate";
  status: "invited" | "active" | "revoked";
  invitationId: string | null;
  name: string;
};

type MemberInput = {
  id: string;
  name: string;
  affiliation?: string | null;
  order?: number | null;
  role?: string | null;
};

export function projectTeamFormation(input: {
  members: MemberInput[];
  invitations: InvitationInput[];
  memberships: MembershipInput[];
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const invitationByMember = new Map<string, InvitationInput>();
  for (const invitation of [...input.invitations].sort((a, b) => b.expiresAt.getTime() - a.expiresAt.getTime())) {
    if (invitation.intendedMemberId && !invitationByMember.has(invitation.intendedMemberId)) {
      invitationByMember.set(invitation.intendedMemberId, invitation);
    }
  }
  const membershipByInvitation = new Map(input.memberships.filter((row) => row.invitationId).map((row) => [row.invitationId as string, row]));
  const ownerMembership = input.memberships.find((row) => row.role === "owner" && row.status === "active") ?? null;

  const members = input.members.map((member, index): TeamFormationMember => {
    if (index === 0) {
      return {
        ...member,
        state: ownerMembership ? "project_access_active" : "listed_on_team",
        invitationId: null,
        invitationExpiresAt: null,
        accessMembershipId: ownerMembership?.id ?? null,
      };
    }
    const invitation = invitationByMember.get(member.id) ?? null;
    const membership = invitation ? membershipByInvitation.get(invitation.id) ?? null : null;
    let state: ParticipantTeammateState = "invitation_ready";
    if (membership?.status === "active") state = "project_access_active";
    else if (membership?.status === "revoked") state = "project_access_revoked";
    else if (invitation?.status === "pending" && invitation.expiresAt.getTime() > now.getTime()) state = "invitation_pending";
    else if (invitation?.status === "expired" || (invitation?.status === "pending" && invitation.expiresAt.getTime() <= now.getTime())) state = "invitation_expired";
    else if (invitation?.status === "revoked") state = "invitation_revoked";
    return {
      ...member,
      state,
      invitationId: invitation?.id ?? null,
      invitationExpiresAt: invitation?.expiresAt ?? null,
      accessMembershipId: membership?.id ?? null,
    };
  });

  return {
    teamLead: members[0] ?? null,
    teammates: members.slice(1),
    members,
    access: input.memberships.map((row) => ({
      id: row.id,
      userId: row.userId,
      name: row.name,
      role: row.role,
      status: row.status,
      invitationId: row.invitationId,
    })),
    teamSize: input.members.length,
    activeAccessCount: input.memberships.filter((row) => row.status === "active").length,
  };
}

export function teammateStateLabel(state: ParticipantTeammateState) {
  switch (state) {
    case "project_access_active": return "Project access active";
    case "project_access_revoked": return "Project access revoked";
    case "invitation_pending": return "Invitation link ready";
    case "invitation_expired": return "Invitation expired";
    case "invitation_revoked": return "Invitation revoked";
    case "invitation_ready": return "Invitation ready";
    default: return "Listed on team";
  }
}

export function teammateStateTone(state: ParticipantTeammateState): "success" | "warning" | "default" {
  if (state === "project_access_active") return "success";
  if (state === "invitation_expired" || state === "invitation_revoked" || state === "project_access_revoked") return "warning";
  return "default";
}

export function invitationExpiryLabel(expiresAt: Date, now = new Date()) {
  const remaining = expiresAt.getTime() - now.getTime();
  if (remaining <= 0) return "Expired";
  const days = Math.ceil(remaining / (24 * 60 * 60 * 1000));
  if (days === 1) return "Expires tomorrow";
  if (days < 7) return `Expires in ${days} days`;
  return `Expires ${expiresAt.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}
