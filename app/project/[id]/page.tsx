export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { NavPublic } from "@/components/NavPublic";
import { db } from "@/lib/db";
import { aiJudgeRuns, aiReviews, audienceVotes, submissions, teamMembers } from "@/lib/db/schema";
import { audienceVotingStatus, getActiveEvent } from "@/lib/events";
import { getEventBranding } from "@/lib/event-branding";
import { getRankingData } from "@/lib/rankings";
import { count, eq, inArray } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";
import ProjectVoteClient from "./ProjectVoteClient";
import { HeroScreenshot } from "./HeroScreenshot";
import { CopyLinkButton } from "./CopyLinkButton";
import { resolveScreenshotUrls } from "@/lib/screenshots";
import { VideoEmbed } from "./VideoEmbed";
import { AwardBadges } from "@/components/AwardBadges";
import { getAwardBadgesForSubmission } from "@/lib/award-badges";
import { ProjectShortcuts } from "./ProjectShortcuts";
import { EventFreezeBanner } from "@/components/EventFreezeBanner";
import { toPublicTeamMembers, type PublicTeamMember } from "@/lib/team-display";
import { listPublicProfileLinksForSubmission, type PublicParticipantProfileLink } from "@/lib/user-profiles";
import ParticipantIdentity from "@/components/ParticipantIdentity";

interface Props {
  params: Promise<{ id: string }>;
}

type AiJudgeRun = InferSelectModel<typeof aiJudgeRuns>;
type TeamMember = InferSelectModel<typeof teamMembers>;
type ProjectIdRow = { id: string };

function scoreFrom(details: unknown, key: string): number | null {
  const value = (details as Record<string, unknown> | null)?.[key];
  return typeof value === "number" ? value : null;
}

function check(details: unknown, key: string): boolean {
  return Boolean(
    ((details as Record<string, unknown> | null)?.checks as Record<string, unknown> | undefined)?.[key]
  );
}

export default async function ProjectPage({ params }: Props) {
  const { id } = await params;

  const [rows, members, event, branding, rankingData, awardBadges, projectRows, profileLinks] = await Promise.all([
    db.select().from(submissions).where(eq(submissions.id, id)),
    db.select().from(teamMembers).where(eq(teamMembers.submissionId, id)).orderBy(teamMembers.order),
    getActiveEvent(),
    getEventBranding(),
    getRankingData(),
    getAwardBadgesForSubmission(id),
    db.select({ id: submissions.id }).from(submissions).where(inArray(submissions.status, ["submitted", "finalized"])),
    listPublicProfileLinksForSubmission(id),
  ]);

  const sub = rows[0];
  if (!sub) notFound();

  const [reviewRows, runRows, voteRows] = await Promise.all([
    db.select().from(aiReviews).where(eq(aiReviews.submissionId, id)),
    db.select().from(aiJudgeRuns).where(eq(aiJudgeRuns.submissionId, id)),
    db.select({ total: count() }).from(audienceVotes).where(eq(audienceVotes.submissionId, id)),
  ]);

  const review = reviewRows[0];
  const completedRuns = (runRows as AiJudgeRun[]).filter((r) => r.status === "complete");

  const consensusValues = completedRuns
    .map((r) => (r.scoresJson as Record<string, number> | null)?.overall_score)
    .filter((v): v is number => typeof v === "number");
  const consensus = consensusValues.length
    ? Math.round(consensusValues.reduce((a, b) => a + b, 0) / consensusValues.length)
    : null;

  const providerChips = completedRuns.map(
    (r) => `${r.modelProvider.replace("external/", "")}/${r.modelName}`
  );

  const ranking = rankingData.rankings.find((r) => r.submissionId === id);
  const peopleRank = rankingData.peoplesChoiceRankings.find((r) => r.submissionId === id);
  const voting = audienceVotingStatus(event);

  const tags = (sub.tags as string[] | null) ?? [];
  const harnesses = (sub.agentHarnesses as string[] | null) ?? [];
  const models = (sub.agentModels as string[] | null) ?? [];
  const details = review?.scoringDetails;
  const repoScore = scoreFrom(details, "repo_score") ?? review?.generatedScore ?? null;

  const officialScore =
    ranking?.officialScore !== null && ranking?.officialScore !== undefined
      ? `${ranking.officialScore}/100`
      : "—";
  const deterministicScore =
    review?.generatedScore !== null && review?.generatedScore !== undefined
      ? `${review.generatedScore}/100`
      : "—";

  const screenshotUrls = resolveScreenshotUrls(sub);
  const publicMembers = toPublicTeamMembers(members as TeamMember[]);

  return (
    <div className="flex flex-col min-h-screen">
      <NavPublic />
      <EventFreezeBanner />
      <ProjectShortcuts
        currentId={id}
        projectIds={(projectRows as ProjectIdRow[]).map((row) => row.id)}
        githubUrl={sub.githubUrl}
        demoUrl={sub.demoUrl}
      />

      <main className="mx-auto max-w-7xl w-full px-4 sm:px-6 py-8 sm:py-12 flex-1">
        {/* Breadcrumb */}
        <nav style={{ marginBottom: "1.25rem" }}>
          <Link
            href="/projects"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.25rem",
              fontSize: "0.8125rem",
              color: "var(--color-subtle)",
              textDecoration: "none",
            }}
          >
            ← Projects
          </Link>
        </nav>

        {/* Hero: screenshot + title card */}
        <section className="grid grid-cols-1 lg:grid-cols-[1.25fr_0.75fr] gap-6 mb-8">
          <HeroScreenshot
            screenshotUrls={screenshotUrls}
            alt={sub.projectTitle ?? sub.teamName}
          />

          {/* Title + vote card */}
          <div className="flex flex-col gap-4">
            <div className="card" style={{ padding: "1.5rem" }}>
              {/* Event + tag badges */}
              <div className="flex flex-wrap gap-2 mb-3">
                <span className="badge badge-default">{branding.eventName}</span>
                {tags.map((tag) => (
                  <span key={tag} className="badge badge-2">
                    {tag}
                  </span>
                ))}
              </div>

              <div style={{ marginBottom: awardBadges.length > 0 ? "0.75rem" : 0 }}>
                <AwardBadges badges={awardBadges} prominence="prominent" />
              </div>

              {/* Title */}
              <h1
                style={{
                  fontFamily: "var(--font-headline)",
                  fontSize: "clamp(1.75rem, 3.5vw, 2.75rem)",
                  lineHeight: 1.05,
                  fontWeight: 900,
                  letterSpacing: "-0.05em",
                  color: "var(--color-fg)",
                  marginBottom: "0.75rem",
                }}
              >
                {sub.projectTitle ?? sub.teamName}
              </h1>

              {/* Team */}
              <p style={{ color: "var(--color-muted)", fontSize: "0.9375rem", lineHeight: 1.65, marginBottom: "1rem" }}>
                by <strong style={{ color: "var(--color-fg)" }}>{sub.teamName}</strong>
                {members.length
                  ? ` · ${(members as TeamMember[]).map((m) => m.name).join(", ")}`
                  : ""}
              </p>

              {/* Description */}
              <p style={{ color: "var(--color-muted)", lineHeight: 1.7, fontSize: "0.9375rem" }}>
                {sub.problemStatement ?? "No description provided."}
              </p>

              {/* CTAs */}
              <div className="flex flex-wrap gap-2" style={{ marginTop: "1.25rem" }}>
                {sub.demoUrl && (
                  <a href={sub.demoUrl} target="_blank" rel="noopener noreferrer" className="btn-primary">
                    Demo ↗
                  </a>
                )}
                {sub.githubUrl && (
                  <a href={sub.githubUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary">
                    GitHub ↗
                  </a>
                )}
                <Link href="/ai-evals" className="btn-secondary">
                  AI Evals
                </Link>
                <CopyLinkButton />
              </div>
            </div>

            <ProjectVoteClient
              submissionId={id}
              initialVotes={voteRows[0]?.total ?? 0}
              votingOpen={voting.open}
              resultsVisible={voting.resultsVisible}
              identityMethod={voting.identityMethod}
              votingMode={voting.votingMode}
            />
          </div>
        </section>

        {/* Demo Video */}
        {sub.demoVideoUrl && (
          <section className="card mb-8" style={{ padding: "1.25rem" }}>
            <h2
              style={{
                fontFamily: "var(--font-headline)",
                color: "var(--color-fg)",
                fontSize: "1.15rem",
                fontWeight: 800,
                marginBottom: "1rem",
              }}
            >
              Demo Video
            </h2>
            <VideoEmbed url={sub.demoVideoUrl} title={sub.projectTitle ?? sub.teamName} />
          </section>
        )}

        {/* Detail grid */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Left column (2/3) */}
          <div className="lg:col-span-2 flex flex-col gap-5">
            <InfoCard title="Project Information">
              <Field label="Problem statement" value={sub.problemStatement} />
              <Field label="Target users" value={sub.targetUsers} />
              {sub.knownLimitations && (
                <Field label="Known limitations" value={sub.knownLimitations} />
              )}
              <Field
                label="Technology stack"
                value={[...harnesses, ...models].join(", ") || null}
              />
            </InfoCard>

            <InfoCard title="Team Information">
              <PublicTeamTable members={publicMembers} profileLinks={profileLinks} />
            </InfoCard>

            <InfoCard title="Agent-Native Build">
              <div className="flex flex-wrap gap-2 mb-3">
                <span className="badge badge-warning">Self-reported</span>
              </div>
              <MetricGrid
                items={[
                  ["Harnesses", harnesses.join(", ") || "—"],
                  ["Models", models.join(", ") || "—"],
                  ["Budget", sub.budgetTier || "—"],
                  ["Human hours", sub.estimatedHumanHours ?? "—"],
                  ["Agent hours", sub.estimatedAgentHours ?? "—"],
                ]}
              />
            </InfoCard>

            <InfoCard title="Repository Review">
              <MetricGrid
                items={[
                  ["Repo score", repoScore !== null ? `${repoScore}/100` : "—"],
                  ["AGENTS.md", check(details, "agents_md_exists") || sub.agentsMdUrl ? "Present" : "Missing"],
                  ["README", check(details, "readme_exists") || sub.readmeUrl ? "Present" : "Missing"],
                  ["License", check(details, "license_exists") || sub.license ? (sub.license ?? "Present") : "Missing"],
                ]}
              />
              {sub.githubUrl && (
                <a
                  href={sub.githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-ghost"
                  style={{ marginTop: "1rem" }}
                >
                  Open repository ↗
                </a>
              )}
            </InfoCard>
          </div>

          {/* Right column (1/3) */}
          <div className="flex flex-col gap-5">
            <InfoCard title="Official Judging">
              <MetricGrid
                items={[
                  ["Official score", officialScore],
                  ["Rank", ranking?.rank ? `#${ranking.rank}` : "—"],
                  ["Status", ranking?.rankStatus ?? "—"],
                ]}
              />
            </InfoCard>

            <InfoCard title="AI Evaluation Summary">
              {completedRuns.length === 0 ? (
                <div>
                  <p style={{ color: "var(--color-muted)", fontSize: "0.875rem", lineHeight: 1.6, marginBottom: "0.75rem" }}>
                    No organizer AI evaluations yet.
                  </p>
                  <Link
                    href="/ai-evals"
                    className="btn-ghost"
                    style={{ fontSize: "0.8125rem", padding: "0.375rem 0.75rem" }}
                  >
                    View AI Evaluations →
                  </Link>
                </div>
              ) : (
                <>
                  <MetricGrid
                    items={[
                      ["Consensus", consensus !== null ? `${consensus}/100` : "—"],
                      ["Evaluations", completedRuns.length],
                      ["Deterministic", deterministicScore],
                    ]}
                  />
                  <div className="flex flex-wrap gap-2" style={{ marginTop: "1rem" }}>
                    {providerChips.slice(0, 6).map((chip) => (
                      <span key={chip} className="badge badge-default">
                        {chip}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </InfoCard>

            <InfoCard title="Audience">
              <MetricGrid
                items={[
                  ["Votes", voteRows[0]?.total ?? 0],
                  ["People's Choice", peopleRank ? `#${peopleRank.rank}` : "—"],
                  ["Voting", voting.label],
                ]}
              />
            </InfoCard>
          </div>
        </section>
      </main>
    </div>
  );
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card" style={{ padding: "1.25rem" }}>
      <h2
        style={{
          fontFamily: "var(--font-headline)",
          color: "var(--color-fg)",
          fontSize: "1.15rem",
          fontWeight: 800,
          marginBottom: "1rem",
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div style={{ marginBottom: "1rem" }}>
      <div
        style={{
          color: "var(--color-subtle)",
          fontSize: "0.72rem",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          marginBottom: "0.25rem",
        }}
      >
        {label}
      </div>
      <p style={{ color: "var(--color-muted)", lineHeight: 1.7 }}>{value || "Not provided."}</p>
    </div>
  );
}

function PublicTeamTable({ members, profileLinks }: { members: PublicTeamMember[]; profileLinks: PublicParticipantProfileLink[] }) {
  if (members.length === 0) {
    return (
      <p style={{ color: "var(--color-muted)", fontSize: "0.875rem", lineHeight: 1.65 }}>
        Team information has not been added yet.
      </p>
    );
  }

  return (
    <>
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 620 }}>
        <thead>
          <tr style={{ color: "var(--color-subtle)", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            {["Name", "Degree(s)", "Institution / affiliation", "Student / trainee"].map((heading) => (
              <th key={heading} style={{ textAlign: "left", padding: "0.65rem 0.5rem", borderBottom: "1px solid var(--color-border)" }}>
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {members.map((member, index) => (
            <tr key={`${member.name}-${index}`} style={{ borderBottom: index === members.length - 1 ? "none" : "1px solid var(--color-border)" }}>
              <td style={{ padding: "0.75rem 0.5rem", color: "var(--color-fg)", fontWeight: 750 }}>
                <span>{member.name}</span>
                {member.role === "Team Lead" && (
                  <span className="badge badge-default" style={{ marginLeft: "0.5rem", fontSize: "0.62rem" }}>
                    Team lead
                  </span>
                )}
              </td>
              <td style={{ padding: "0.75rem 0.5rem", color: "var(--color-muted)" }}>{member.degrees || "—"}</td>
              <td style={{ padding: "0.75rem 0.5rem", color: "var(--color-muted)" }}>{member.affiliation || "—"}</td>
              <td style={{ padding: "0.75rem 0.5rem", color: member.isStudentTrainee ? "var(--color-success)" : "var(--color-subtle)", fontWeight: 800 }}>
                {member.isStudentTrainee ? "✓" : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    {profileLinks.length > 0 && (
      <div style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid var(--color-border)" }}>
        <p style={{ color: "var(--color-subtle)", fontSize: "0.68rem", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "0.35rem" }}>Public participant profiles</p>
        <p style={{ color: "var(--color-muted)", fontSize: "0.76rem", lineHeight: 1.5, marginBottom: "0.7rem" }}>Teammates who chose to share a public profile appear here.</p>
        <div className="public-profile-identity-list">
          {profileLinks.map((profile) => <ParticipantIdentity key={profile.handle} variant="full" identity={profileIdentity(profile)} />)}
        </div>
      </div>
    )}
    </>
  );
}

function profileIdentity(profile: PublicParticipantProfileLink) {
  const words = profile.displayName.trim().split(/\s+/).filter(Boolean);
  const initials = (words.length > 1 ? `${words[0][0]}${words[words.length - 1][0]}` : profile.displayName.slice(0, 2)).toUpperCase();
  return { displayName: profile.displayName, initials, handle: profile.handle, headline: profile.headline, affiliation: profile.affiliation };
}

function MetricGrid({ items }: { items: Array<[string, string | number]> }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {items.map(([label, value]) => (
        <div
          key={label}
          style={{
            padding: "0.75rem",
            borderRadius: 10,
            border: "1px solid var(--color-border)",
            background: "var(--color-surface-2)",
          }}
        >
          <div
            style={{
              color: "var(--color-subtle)",
              fontSize: "0.68rem",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: "0.25rem",
            }}
          >
            {label}
          </div>
          <div style={{ color: "var(--color-fg)", fontWeight: 800 }}>{value}</div>
        </div>
      ))}
    </div>
  );
}
