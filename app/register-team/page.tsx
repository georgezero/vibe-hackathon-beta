export const dynamic = "force-dynamic";

import { NavPublic } from "@/components/NavPublic";
import { GitHubSignInButton } from "@/components/GitHubSignInButton";
import { githubOAuthConfigured, getTeamSessionUser } from "@/lib/team-auth";
import { getActiveEvent, submissionDeadlineStatus } from "@/lib/events";
import { RegisterTeamClient } from "./RegisterTeamClient";
import { githubAuthRequired } from "@/lib/ownership-mode";
import { EventFreezeBanner } from "@/components/EventFreezeBanner";

export default async function RegisterTeamPage() {
  const [user, event] = await Promise.all([getTeamSessionUser(), getActiveEvent()]);
  const deadline = submissionDeadlineStatus(event);
  const requireGitHub = githubAuthRequired();

  return (
    <div className="flex flex-col min-h-screen">
      <NavPublic />
      <EventFreezeBanner />
      <main className="mx-auto max-w-2xl w-full px-4 sm:px-6 py-12 flex-1">
        <div className="mb-8">
          <span className="badge badge-default" style={{ marginBottom: "1rem" }}>Project setup</span>
          <h1 style={{ fontFamily: "var(--font-headline)", fontSize: "2.5rem", fontWeight: 900, letterSpacing: "-0.05em", color: "var(--color-fg)", marginBottom: "0.75rem" }}>
            Start your project
          </h1>
          <p style={{ color: "var(--color-muted)", lineHeight: 1.7 }}>
            {requireGitHub
              ? "Add your team lead details to create a private project. This account will manage the project; teammates can be added next."
              : "Add your team lead details to create a private project. Your email and badge number verify event participation and help recover it."}
          </p>
        </div>

        {!deadline.open ? (
          <div className="card" style={{ padding: "1.5rem" }}>
            <span className="badge badge-default">Submissions closed</span>
            <p style={{ color: "var(--color-muted)", marginTop: "1rem" }}>{deadline.label}</p>
          </div>
        ) : requireGitHub && !user ? (
          <div className="card" style={{ padding: "1.5rem" }}>
            <h2 style={{ color: "var(--color-fg)", fontWeight: 800, marginBottom: "0.5rem" }}>GitHub sign-in required</h2>
            <p style={{ color: "var(--color-muted)", fontSize: "0.875rem", lineHeight: 1.6, marginBottom: "1rem" }}>
              Only one GitHub account is required per team. This account will be used to recover and manage the team submission.
            </p>
            {githubOAuthConfigured() ? (
              <GitHubSignInButton callbackURL="/register-team" />
            ) : (
              <div className="badge badge-warning">GitHub OAuth is not configured. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET.</div>
            )}
          </div>
        ) : (
          <RegisterTeamClient
            githubLogin={user?.githubUsername ?? null}
            githubEmail={user?.email ?? ""}
            githubRequired={requireGitHub}
          />
        )}
      </main>
    </div>
  );
}
