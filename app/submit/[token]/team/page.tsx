export const dynamic = "force-dynamic";

import Link from "next/link";
import { NavPublic } from "@/components/NavPublic";
import { db } from "@/lib/db";
import { submissions, teamMembers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { TeamManagementClient, type EditableMember } from "./TeamManagementClient";
import type { InferSelectModel } from "drizzle-orm";
import { EventFreezeBanner } from "@/components/EventFreezeBanner";
import { headers } from "next/headers";
import { resolveApplicationPrincipal } from "@/lib/application-principal";
import { listSubmissionMembershipInvitations, listSubmissionMemberships, resolveSubmissionOwnerMembership } from "@/lib/submission-memberships";

type TeamMember = InferSelectModel<typeof teamMembers>;

interface Props {
  params: Promise<{ token: string }>;
}

function toEditable(member: typeof teamMembers.$inferSelect | null, fallback: { name: string; email: string }): EditableMember {
  return {
    id: member?.id,
    name: member?.name ?? fallback.name,
    email: member?.email ?? fallback.email,
    badgeNumber: member?.badgeNumber ?? "",
    affiliation: member?.affiliation ?? "",
    degrees: member?.degrees ?? "",
    isStudentTrainee: Boolean(member?.isStudentTrainee),
  };
}

export default async function TeamManagementPage({ params }: Props) {
  const { token } = await params;
  const sub = (await db.select().from(submissions).where(eq(submissions.editToken, token)))[0];

  if (!sub) {
    return (
      <div className="flex flex-col min-h-screen">
        <NavPublic />
        <EventFreezeBanner />
        <main className="mx-auto max-w-2xl w-full px-4 sm:px-6 py-16 flex-1">
          <div className="card" style={{ padding: "2rem", textAlign: "center" }}>
            <span className="badge badge-default">Invalid edit link</span>
            <h1 style={{ fontFamily: "var(--font-headline)", color: "var(--color-fg)", fontSize: "2rem", marginTop: "1rem" }}>Team not found</h1>
          </div>
        </main>
      </div>
    );
  }

  const members: TeamMember[] = await db.select().from(teamMembers).where(eq(teamMembers.submissionId, sub.id)).orderBy(teamMembers.order);
  const owner = toEditable(members[0] ?? null, { name: sub.teamName, email: sub.contactEmail });
  const teammates = members.slice(1).map((member) => toEditable(member, { name: "", email: "" }));
  const principal = await resolveApplicationPrincipal(await headers());
  const ownerAccess = principal.status === "authenticated"
    ? await resolveSubmissionOwnerMembership({ submissionId: sub.id, userId: principal.principal.user.id })
    : { status: "none" as const };
  const membershipRows = ownerAccess.status === "active"
    ? await listSubmissionMemberships(sub.id)
    : [];
  const invitationRows = ownerAccess.status === "active"
    ? await listSubmissionMembershipInvitations(sub.id)
    : [];

  return (
    <div className="flex flex-col min-h-screen">
      <NavPublic />
      <EventFreezeBanner />
      <main className="mx-auto max-w-4xl w-full px-4 sm:px-6 py-10 flex-1">
        <div style={{ marginBottom: "1.5rem" }}>
          <Link href={`/submit/${token}/start`} style={{ color: "var(--color-subtle)", fontSize: "0.8125rem", textDecoration: "none" }}>← Back to project setup</Link>
          <h1 style={{ fontFamily: "var(--font-headline)", color: "var(--color-fg)", fontSize: "clamp(2rem, 5vw, 3.6rem)", fontWeight: 900, letterSpacing: "-0.05em", marginTop: "0.75rem" }}>
            Your team
          </h1>
          <p style={{ color: "var(--color-muted)", lineHeight: 1.65, marginTop: "0.5rem" }}>
            Add teammates, confirm badge details, and choose who can collaborate on the private project before submitting.
          </p>
        </div>
        <TeamManagementClient
          token={token}
          submissionId={sub.id}
          teamName={sub.teamName}
          owner={owner}
          members={teammates}
          canManageMemberships={ownerAccess.status === "active"}
          memberships={membershipRows.map((row: typeof membershipRows[number]) => ({
            id: row.membership.id,
            role: row.membership.role,
            status: row.membership.status,
            name: row.user.name,
            email: row.user.email,
          }))}
          invitations={invitationRows.map((row: typeof invitationRows[number]) => ({
            id: row.id,
            status: row.status,
            expiresAt: row.expiresAt.toISOString(),
            intendedMemberId: row.intendedMemberId,
          }))}
        />
      </main>
    </div>
  );
}
