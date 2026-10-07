export const dynamic = "force-dynamic";

import { eq, inArray } from "drizzle-orm";
import { NavPublic } from "@/components/NavPublic";
import { GitHubSignInButton } from "@/components/GitHubSignInButton";
import { db } from "@/lib/db";
import { submissionOwners, submissions, teamMembers } from "@/lib/db/schema";
import { githubOAuthConfigured, getTeamSessionUser } from "@/lib/team-auth";
import { submissionLinks } from "@/lib/submission-links";
import { RecoverClient } from "./RecoverClient";
import type { InferSelectModel } from "drizzle-orm";
import { githubAuthRequired } from "@/lib/ownership-mode";
import { computePrizeEligibility } from "@/lib/prize-eligibility";

type SubmissionOwner = InferSelectModel<typeof submissionOwners>;
type Submission = InferSelectModel<typeof submissions>;
type TeamMember = InferSelectModel<typeof teamMembers>;

export default async function RecoverPage() {
  const user = await getTeamSessionUser();
  const requireGitHub = githubAuthRequired();
  let owned: Array<{ id: string; teamName: string; projectTitle: string | null; editUrl: string; previewUrl: string; manageTeamUrl: string; teamSize: number; badgeCount: number; eligibleForPrize: boolean }> = [];

  if (user) {
    const ownerRows: SubmissionOwner[] = await db.select().from(submissionOwners).where(eq(submissionOwners.userId, user.id));
    const ids = ownerRows.map((row: SubmissionOwner) => row.submissionId);
    const subRows: Submission[] = ids.length ? await db.select().from(submissions).where(inArray(submissions.id, ids)) : [];
    const members: TeamMember[] = ids.length ? await db.select().from(teamMembers).where(inArray(teamMembers.submissionId, ids)) : [];
    owned = subRows.map((sub: Submission) => {
      const links = submissionLinks(sub.editToken, sub.id);
      const summary = computePrizeEligibility(members.filter((member) => member.submissionId === sub.id).map((member) => ({ name: member.name, badgeNumber: member.badgeNumber, isStudentTrainee: member.isStudentTrainee })));
      return { id: sub.id, teamName: sub.teamName, projectTitle: sub.projectTitle, editUrl: links.edit_url, previewUrl: links.preview_url, manageTeamUrl: links.start_url.replace("/start", "/team"), teamSize: summary.memberCount, badgeCount: summary.badgeCount, eligibleForPrize: summary.eligibleForPrize };
    });
  }

  return (
    <div className="flex flex-col min-h-screen">
      <NavPublic />
      <main className="mx-auto max-w-3xl w-full px-4 sm:px-6 py-12 flex-1">
        <h1 style={{ fontFamily: "var(--font-headline)", fontSize: "2.5rem", fontWeight: 900, letterSpacing: "-0.05em", color: "var(--color-fg)", marginBottom: "0.75rem" }}>
          Recover your projects
        </h1>
        <p style={{ color: "var(--color-muted)", lineHeight: 1.7, marginBottom: "1.5rem" }}>
          {requireGitHub
            ? "Sign in with the GitHub account used to register your team to find your saved projects."
            : "Use the contact email and team lead badge number from project creation to find your saved projects."}
        </p>

        {!requireGitHub ? (
          <RecoverClient submissions={[]} badgeMode />
        ) : !user ? (
          <div className="card" style={{ padding: "1.5rem" }}>
            {githubOAuthConfigured() ? (
              <GitHubSignInButton callbackURL="/recover" />
            ) : (
              <div className="badge badge-warning">GitHub OAuth is not configured.</div>
            )}
          </div>
        ) : owned.length > 0 ? (
          <RecoverClient submissions={owned} />
        ) : (
          <div className="card" style={{ padding: "1.5rem", color: "var(--color-muted)" }}>
            No submissions are owned by @{user.githubUsername}.
          </div>
        )}
      </main>
    </div>
  );
}
