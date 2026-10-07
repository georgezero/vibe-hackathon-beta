export const dynamic = "force-dynamic";

import { headers } from "next/headers";
import { NavPublic } from "@/components/NavPublic";
import { applicationHeaderAccount } from "@/lib/application-account-display";
import { getAccountOverview } from "@/lib/account-directory";
import { resolveApplicationPrincipal } from "@/lib/application-principal";
import { getJudgingEvent } from "@/lib/judging-event";
import AccountSettingsClient from "./AccountSettingsClient";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { submissionMemberships, submissions } from "@/lib/db/schema";
import { ensureOwnProfile, getProfileCompleteness, toProfileEditorData } from "@/lib/user-profiles";

export default async function AccountPage() {
  const eventId = process.env.VIBE_JUDGE_EVENT_ID?.trim() || "evt_vibe_2025";
  const [requestHeaders, event] = await Promise.all([
    headers(),
    getJudgingEvent(eventId),
  ]);
  const resolution = await resolveApplicationPrincipal(requestHeaders, {
    eventId,
  });
  if (resolution.status !== "authenticated") {
    return (
      <div className="min-h-screen">
        <NavPublic />
        <main className="mx-auto w-full max-w-3xl px-4 sm:px-6 py-16">
          <section className="card account-signed-out">
            <div className="account-empty-icon" aria-hidden="true">
              <AccountIcon />
            </div>
            <h1>Sign in to manage your account</h1>
            <p>
              Account settings are available after you authenticate with an
              existing Vibe Hackathon sign-in method.
            </p>
            <div className="account-sign-in-actions">
              <a className="btn-primary" href="/login?returnTo=%2Faccount">Sign in</a>
            </div>
          </section>
        </main>
      </div>
    );
  }
  const overview = await getAccountOverview({
    userId: resolution.principal.user.id,
    sessionId: resolution.principal.session.id,
    eventId,
    eventName: event?.name ?? null,
  });
  if (!overview) {
    return (
      <div className="min-h-screen">
        <NavPublic />
        <main className="mx-auto w-full max-w-3xl px-4 sm:px-6 py-16">
          <section className="card account-signed-out">
            <h1>Account unavailable</h1>
            <p>The signed-in account could not be loaded safely.</p>
          </section>
        </main>
      </div>
    );
  }
  const [profile, projects] = await Promise.all([ensureOwnProfile(resolution.principal.user.id), db.select({
    submissionId: submissionMemberships.submissionId,
    role: submissionMemberships.role,
    title: submissions.projectTitle,
    teamName: submissions.teamName,
    status: submissions.status,
  }).from(submissionMemberships)
    .innerJoin(submissions, eq(submissions.id, submissionMemberships.submissionId))
    .where(and(
      eq(submissionMemberships.userId, resolution.principal.user.id),
      eq(submissionMemberships.status, "active"),
    ))]);

  const account = applicationHeaderAccount({
    display_name: resolution.principal.user.name?.trim()
      || resolution.principal.user.email,
    roles: resolution.principal.roles,
  });
  return (
    <div className="min-h-screen">
      <NavPublic authenticatedAccount={account} />
      <AccountSettingsClient
        overview={{
          ...overview,
          account: {
            ...overview.account,
            passwordChangedAt: overview.account.passwordChangedAt?.toISOString() ?? null,
          },
          participantProfile: {
            ...toProfileEditorData(profile),
            completeness: getProfileCompleteness(profile),
          },
          profile: {
            ...overview.profile,
            createdAt: overview.profile.createdAt.toISOString(),
            lastSignInAt: overview.profile.lastSignInAt?.toISOString() ?? null,
          },
          sessions: overview.sessions.map((session) => ({
            ...session,
            createdAt: session.createdAt.toISOString(),
            updatedAt: session.updatedAt.toISOString(),
          expiresAt: session.expiresAt.toISOString(),
        })),
        projects,
      }}
      />
    </div>
  );
}

function AccountIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="M5.5 19c.8-3.3 3-5 6.5-5s5.7 1.7 6.5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
