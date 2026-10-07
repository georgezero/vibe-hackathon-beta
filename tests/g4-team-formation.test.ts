import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { projectTeamFormation, teammateStateLabel } from "@/lib/team-formation";

const at = (offsetMs: number) => new Date(1_700_000_000_000 + offsetMs);

describe("G.4 participant team formation projection", () => {
  it("keeps roster listing separate from invitation and project access", () => {
    const projection = projectTeamFormation({
      now: at(0),
      members: [
        { id: "lead", name: "Team Lead" },
        { id: "pending", name: "Pending Teammate" },
        { id: "active", name: "Active Teammate" },
        { id: "expired", name: "Expired Teammate" },
      ],
      invitations: [
        { id: "invite-pending", status: "pending", expiresAt: at(86_400_000), intendedMemberId: "pending" },
        { id: "invite-active", status: "accepted", expiresAt: at(86_400_000), intendedMemberId: "active" },
        { id: "invite-expired", status: "pending", expiresAt: at(-1), intendedMemberId: "expired" },
      ],
      memberships: [
        { id: "membership-lead", userId: "lead-user", role: "owner", status: "active", invitationId: null, name: "Team Lead" },
        { id: "membership-active", userId: "active-user", role: "teammate", status: "active", invitationId: "invite-active", name: "Active Teammate" },
      ],
    });
    expect(projection.teamLead?.state).toBe("project_access_active");
    expect(projection.teammates.map((member) => member.state)).toEqual([
      "invitation_pending",
      "project_access_active",
      "invitation_expired",
    ]);
    expect(projection.teamSize).toBe(4);
    expect(projection.activeAccessCount).toBe(2);
    expect(teammateStateLabel("invitation_pending")).toBe("Invitation link ready");
  });

  it("prefers the newest invitation for a listed teammate", () => {
    const projection = projectTeamFormation({
      now: at(0),
      members: [{ id: "lead", name: "Lead" }, { id: "member", name: "Member" }],
      invitations: [
        { id: "old", status: "revoked", expiresAt: at(-100), intendedMemberId: "member" },
        { id: "new", status: "pending", expiresAt: at(86_400_000), intendedMemberId: "member" },
      ],
      memberships: [],
    });
    expect(projection.teammates[0]).toMatchObject({ state: "invitation_pending", invitationId: "new" });
  });

  it("keeps the private roster endpoint bearer-protected and blocks edits after deadline", () => {
    const route = readFileSync("app/api/v1/submissions/[id]/team/route.ts", "utf8");
    expect(route).toContain('authHeader?.replace("Bearer ", "").trim()');
    expect(route).toContain('code: "DEADLINE_PASSED"');
    expect(route).toContain("submissionDeadlineStatus(event)");
  });

  it("rate-limits invitation creation and acceptance without adding delivery assumptions", () => {
    const createRoute = readFileSync("app/api/submission-memberships/invitations/route.ts", "utf8");
    const acceptRoute = readFileSync("app/api/submission-memberships/invitations/accept/route.ts", "utf8");
    expect(createRoute).toContain("invite-create:");
    expect(acceptRoute).toContain("invite-accept:");
    expect(createRoute).toContain("Invitation limit reached");
    expect(acceptRoute).toContain("Too many invitation attempts");
  });
});
