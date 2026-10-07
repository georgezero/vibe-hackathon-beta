import Link from "next/link";
import { cookies, headers } from "next/headers";
import { NavPublic } from "@/components/NavPublic";
import { resolveApplicationPrincipal } from "@/lib/application-principal";
import { inspectTeammateInvitation } from "@/lib/submission-memberships";
import { db } from "@/lib/db";
import { submissionMemberships, users } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { JoinInvitationClient } from "./JoinInvitationClient";
import { INVITATION_COOKIE } from "@/lib/submission-membership-constants";

export const dynamic = "force-dynamic";

export default async function JoinInvitationPage() {
  const token = (await cookies()).get(INVITATION_COOKIE)?.value ?? "";
  const inspected = token ? await inspectTeammateInvitation(token) : { status: "not_found" as const };
  const principal = await resolveApplicationPrincipal(await headers());

  if (inspected.status !== "pending" && inspected.status !== "accepted") {
    const expired = inspected.status === "expired";
    const revoked = inspected.status === "revoked";
    return <JoinShell><span className={`badge ${expired || revoked ? "badge-warning" : "badge-error"}`}>{expired ? "Invitation expired" : revoked ? "Invitation revoked" : "Invitation unavailable"}</span><h1>{expired ? "This invitation expired." : revoked ? "This invitation was revoked." : "That invitation is no longer available."}</h1><p>{expired || revoked ? "Ask the project owner to create a new teammate invitation." : "Check the link or ask the project owner to create a new teammate invitation."}</p><Link className="btn-secondary" href="/projects">Return to projects</Link></JoinShell>;
  }

  const ownerRows = await db.select({ name: users.name }).from(submissionMemberships)
    .innerJoin(users, eq(users.id, submissionMemberships.userId))
    .where(and(eq(submissionMemberships.submissionId, inspected.submission.id), eq(submissionMemberships.role, "owner"), eq(submissionMemberships.status, "active"))).limit(1);
  if (principal.status !== "authenticated") {
    return <JoinShell><span className="badge badge-warning">Sign in required</span><h1>Join {inspected.submission.teamName}</h1><p>You&apos;ve been invited to collaborate on <strong>{inspected.submission.projectTitle || "this project"}</strong>. Sign in to the account you want to use for private project access, then confirm the invitation.</p><p className="invitation-note">This private link is not bound to an account until it is accepted. Check which account is signed in before you join.</p><Link className="btn-primary" href="/login?returnTo=%2Fprojects%2Fjoin">Sign in to continue</Link></JoinShell>;
  }

  return <JoinShell><JoinInvitationClient teamName={inspected.submission.teamName} projectTitle={inspected.submission.projectTitle} ownerName={ownerRows[0]?.name ?? null} intendedMemberName={inspected.intendedMember?.name ?? null} signedInAs={principal.principal.user.name?.trim() || principal.principal.user.email} expiresAt={inspected.invitation.expiresAt.toISOString()} /></JoinShell>;
}

function JoinShell({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen"><NavPublic /><main className="mx-auto w-full max-w-xl px-4 sm:px-6 py-16"><div style={{ marginBottom: "1.2rem" }}><Link href="/account/projects" style={{ color: "var(--color-subtle)", textDecoration: "none", fontSize: "0.82rem" }}>← My Projects</Link></div>{children}</main></div>;
}
