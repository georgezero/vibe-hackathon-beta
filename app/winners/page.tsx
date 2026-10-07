export const dynamic = "force-dynamic";

import Link from "next/link";
import { NavPublic } from "@/components/NavPublic";
import { db } from "@/lib/db";
import { aiJudgeRuns, aiReviews, submissions } from "@/lib/db/schema";
import { getActiveEvent, judgingDeadlineStatus } from "@/lib/events";
import { getEventBranding } from "@/lib/event-branding";
import { getRankingData, type FinalRanking, type PeoplesChoiceRanking } from "@/lib/rankings";
import type { InferSelectModel } from "drizzle-orm";
import { resolveScreenshotUrls } from "@/lib/screenshots";
import { AwardBadges } from "@/components/AwardBadges";
import { getAwardBadgeMap } from "@/lib/award-badges";
import { getPublicationData } from "@/lib/publication";
import { ParticipantEmptyState } from "@/components/ParticipantEmptyState";

interface Props {
  searchParams?: Promise<{ preview?: string }>;
}

type Submission = InferSelectModel<typeof submissions>;
type AiReview = InferSelectModel<typeof aiReviews>;
type AiJudgeRun = InferSelectModel<typeof aiJudgeRuns>;

type Award = {
  key: string;
  title: string;
  icon: string;
  source: string;
  experimental?: boolean;
  metricLabel: string;
  metricValue: string;
  submissionId: string;
  projectTitle: string | null;
  teamName: string;
  description: string | null;
  screenshotUrl: string | null;
  demoVideoUrl: string | null;
  highlights: string[];
};

type Consensus = {
  submissionId: string;
  averageOverall: number;
  averagePresentation: number | null;
  runCount: number;
};

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function numericScore(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function buildConsensus(runs: AiJudgeRun[]): Record<string, Consensus> {
  const grouped: Record<string, { overall: number[]; presentation: number[] }> = {};
  for (const run of runs) {
    if (run.status !== "complete") continue;
    const scores = run.scoresJson as Record<string, unknown> | null;
    const overall = numericScore(scores?.overall_score);
    if (overall === null) continue;
    const presentation = numericScore(scores?.presentation_score);
    const group = (grouped[run.submissionId] ??= { overall: [], presentation: [] });
    group.overall.push(overall);
    if (presentation !== null) group.presentation.push(presentation);
  }
  return Object.fromEntries(Object.entries(grouped).map(([submissionId, scores]) => [
    submissionId,
    {
      submissionId,
      averageOverall: round1(scores.overall.reduce((sum, score) => sum + score, 0) / scores.overall.length),
      averagePresentation: scores.presentation.length > 0
        ? round1(scores.presentation.reduce((sum, score) => sum + score, 0) / scores.presentation.length)
        : null,
      runCount: scores.overall.length,
    },
  ]));
}

function agentNativeScore(review: AiReview | undefined): { score: number | null; highlights: string[] } {
  const details = review?.scoringDetails as Record<string, unknown> | null;
  if (!details) return { score: null, highlights: [] };
  const agent = numericScore(details.agent_readiness_score);
  const docs = numericScore(details.documentation_score);
  const repro = numericScore(details.reproducibility_score);
  const score = [agent, docs, repro].filter((v): v is number => v !== null);
  const checks = details.checks as Record<string, unknown> | undefined;
  const highlights: string[] = [];
  if (checks?.agents_md_exists) highlights.push("AGENTS.md present");
  if (checks?.vibe_json_exists) highlights.push("vibe.json present");
  if (checks?.prompts_md_exists) highlights.push("Prompt evidence documented");
  if (docs !== null) highlights.push(`Documentation ${docs}/100`);
  if (repro !== null) highlights.push(`Reproducibility ${repro}/100`);
  return {
    score: score.length > 0 ? round1(score.reduce((sum, value) => sum + value, 0) / score.length) : null,
    highlights: highlights.slice(0, 4),
  };
}

function awardFromRanking(ranking: FinalRanking | undefined, subs: Record<string, Submission>): Award | null {
  if (!ranking || ranking.officialScore === null) return null;
  const sub = subs[ranking.submissionId];
  return {
    key: "judge-choice",
    title: "Judge Choice",
    icon: "🏆",
    source: "Official Judges",
    metricLabel: "Final score",
    metricValue: `${ranking.officialScore}/100`,
    submissionId: ranking.submissionId,
    projectTitle: ranking.projectTitle,
    teamName: ranking.teamName,
    description: sub?.problemStatement ?? null,
    screenshotUrl: sub ? (resolveScreenshotUrls(sub)[0] ?? null) : null,
    demoVideoUrl: sub?.demoVideoUrl ?? null,
    highlights: ["Human judges 70%", "Deterministic AI review 30%"],
  };
}

function awardFromPeople(winner: PeoplesChoiceRanking | undefined, subs: Record<string, Submission>): Award | null {
  if (!winner) return null;
  const sub = subs[winner.submissionId];
  return {
    key: "peoples-choice",
    title: "People's Choice",
    icon: "❤",
    source: "Audience Vote",
    metricLabel: "Votes",
    metricValue: String(winner.audienceVotes),
    submissionId: winner.submissionId,
    projectTitle: winner.projectTitle,
    teamName: winner.teamName,
    description: sub?.problemStatement ?? null,
    screenshotUrl: sub ? (resolveScreenshotUrls(sub)[0] ?? null) : null,
    demoVideoUrl: sub?.demoVideoUrl ?? null,
    highlights: ["Audience-only ranking", "Separate from official awards"],
  };
}

export default async function WinnersPage({ searchParams }: Props) {
  const preview = (await searchParams)?.preview === "1";
  const event = await getActiveEvent();
  const [branding, publication, rankingData, allSubs, allReviews, allRuns] = await Promise.all([
    getEventBranding(),
    getPublicationData(event.id),
    getRankingData(),
    db.select().from(submissions) as Promise<Submission[]>,
    db.select().from(aiReviews) as Promise<AiReview[]>,
    db.select().from(aiJudgeRuns) as Promise<AiJudgeRun[]>,
  ]);

  const eventToggles = event as typeof event & {
    showJudgeChoice?: boolean;
    showPeoplesChoice?: boolean;
    showAIChoice?: boolean;
    showSpecialAwards?: boolean;
  };
  // D.4 publication is the participant-facing authority. The legacy event
  // winnersPublishedAt field may be populated by older operator tooling and
  // must not make unpublished results look public.
  const isPublished = publication.release.status === "published" || publication.release.status === "archived";
  const canShowAwards = isPublished || preview;
  const awardBadgeMap = await getAwardBadgeMap({ preview, event });
  const judgingStatus = judgingDeadlineStatus(event);
  const subsById = Object.fromEntries(allSubs.map((s: Submission) => [s.id, s]));
  const consensusById = buildConsensus(allRuns);

  const ranked = rankingData.rankings.filter((r) => r.officialScore !== null).sort((a, b) => (a.rank ?? 9999) - (b.rank ?? 9999));
  const judgeChoice = awardFromRanking(ranked[0], subsById);
  const peoplesChoice = awardFromPeople(rankingData.peoplesChoiceRankings[0], subsById);

  const aiConsensusWinner = Object.values(consensusById).sort((a, b) => b.averageOverall - a.averageOverall)[0];
  const aiChoice = aiConsensusWinner ? (() => {
    const sub = subsById[aiConsensusWinner.submissionId];
    return sub ? {
      key: "ai-choice",
      title: "AI Choice",
      icon: "✦",
      source: "AI Consensus",
      experimental: true,
      metricLabel: `${aiConsensusWinner.runCount} AI eval${aiConsensusWinner.runCount === 1 ? "" : "s"}`,
      metricValue: `${aiConsensusWinner.averageOverall}/100`,
      submissionId: sub.id,
      projectTitle: sub.projectTitle,
      teamName: sub.teamName,
      description: sub.problemStatement,
      screenshotUrl: resolveScreenshotUrls(sub)[0] ?? null,
      demoVideoUrl: sub.demoVideoUrl ?? null,
      highlights: ["Experimental", "Based on organizer AI evaluations"],
    } satisfies Award : null;
  })() : null;

  const agentNativeCandidate = allReviews
    .map((review: AiReview) => ({ review, ...agentNativeScore(review) }))
    .filter((row) => row.score !== null)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
  const agentNative = agentNativeCandidate ? (() => {
    const sub = subsById[agentNativeCandidate.review.submissionId];
    return sub ? {
      key: "best-agent-native",
      title: "Best Agent-Native Project",
      icon: "⚙",
      source: "Automated Review",
      metricLabel: "Agent-native score",
      metricValue: `${agentNativeCandidate.score}/100`,
      submissionId: sub.id,
      projectTitle: sub.projectTitle,
      teamName: sub.teamName,
      description: sub.problemStatement,
      screenshotUrl: resolveScreenshotUrls(sub)[0] ?? null,
      demoVideoUrl: sub.demoVideoUrl ?? null,
      highlights: agentNativeCandidate.highlights,
    } satisfies Award : null;
  })() : null;

  const presentationWinner = Object.values(consensusById).filter((c) => c.averagePresentation !== null).sort((a, b) => (b.averagePresentation ?? 0) - (a.averagePresentation ?? 0))[0];
  const bestPresentation = presentationWinner ? (() => {
    const sub = subsById[presentationWinner.submissionId];
    return sub ? {
      key: "best-presentation",
      title: "Best Presentation",
      icon: "◈",
      source: "AI Evaluation",
      metricLabel: "Presentation score",
      metricValue: `${presentationWinner.averagePresentation}/100`,
      submissionId: sub.id,
      projectTitle: sub.projectTitle,
      teamName: sub.teamName,
      description: sub.problemStatement,
      screenshotUrl: resolveScreenshotUrls(sub)[0] ?? null,
      demoVideoUrl: sub.demoVideoUrl ?? null,
      highlights: [`${presentationWinner.runCount} organizer AI eval${presentationWinner.runCount === 1 ? "" : "s"}`],
    } satisfies Award : null;
  })() : null;

  const awards: Award[] = [
    eventToggles.showJudgeChoice !== false ? judgeChoice : null,
    event.audienceVotingEnabled && eventToggles.showPeoplesChoice !== false ? peoplesChoice : null,
    eventToggles.showAIChoice !== false ? aiChoice : null,
    eventToggles.showSpecialAwards !== false ? agentNative : null,
    eventToggles.showSpecialAwards !== false ? bestPresentation : null,
  ].filter((award): award is Award => award !== null);

  const topRows = ranked.slice(0, 10).map((ranking) => ({
    ranking,
    consensus: consensusById[ranking.submissionId],
  }));

  return (
    <div className="flex flex-col min-h-screen">
      <NavPublic />
      <main className="mx-auto max-w-7xl w-full px-4 sm:px-6 py-10 sm:py-14 flex-1">
        <section className="text-center mb-10 sm:mb-14">
          {branding.logoUrl && (
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "1.25rem" }}>
              <img src={branding.logoUrl} alt={branding.eventName} style={{ height: 58, maxWidth: 220, objectFit: "contain" }} />
            </div>
          )}
          <div className="badge badge-default" style={{ marginBottom: "1rem" }}>{preview && !isPublished ? "Awards Preview" : "Awards Ceremony"}</div>
          {branding.eventName && (
            <div style={{ fontSize: "0.875rem", color: "var(--color-muted)", marginBottom: "0.5rem" }}>{branding.eventName}</div>
          )}
          <h1 style={{ fontFamily: "var(--font-headline)", fontSize: "clamp(2.5rem, 8vw, 5.5rem)", fontWeight: 800, letterSpacing: "-0.06em", color: "var(--color-fg)", lineHeight: 0.95, marginBottom: "1rem" }}>
            Results
          </h1>
          <p style={{ color: "var(--color-muted)", fontSize: "clamp(1rem, 2vw, 1.25rem)", lineHeight: 1.65, maxWidth: 680, margin: "0 auto" }}>
            Celebrate the top projects from this event.
          </p>
          {branding.tagline && <p style={{ color: "var(--color-subtle)", fontSize: "0.9375rem", marginTop: "0.75rem" }}>{branding.tagline}</p>}
        </section>

        {!canShowAwards && (
          <section className="card" style={{ padding: "2rem", textAlign: "center", marginBottom: "2rem" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>🏆</div>
            <h2 style={{ fontFamily: "var(--font-headline)", color: "var(--color-fg)", fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.5rem" }}>
              Results aren’t published yet.
            </h2>
            <p style={{ color: "var(--color-muted)", lineHeight: 1.65 }}>
              Check back after judging is complete. Current standings may still change.
            </p>
          </section>
        )}

        {canShowAwards && !judgingStatus.open && !isPublished && (
          <div className="badge badge-warning" style={{ display: "block", width: "fit-content", margin: "0 auto 1.5rem" }}>
            Winners will be announced after judging closes.
          </div>
        )}

        {canShowAwards && awards.length === 0 && (
          <section className="card" style={{ padding: "2rem", textAlign: "center", marginBottom: "2rem" }}>
            <h2 style={{ color: "var(--color-fg)", fontWeight: 700, marginBottom: "0.5rem" }}>No award data yet</h2>
            <p style={{ color: "var(--color-muted)", lineHeight: 1.65 }}>Submissions, judging, votes, or AI evaluations are needed before winners can be computed.</p>
          </section>
        )}

        {canShowAwards && awards.length > 0 && (
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-12">
            {awards.map((award, index) => (
              <AwardCard key={award.key} award={award} featured={index === 0} badges={awardBadgeMap[award.submissionId] ?? []} />
            ))}
          </section>
        )}

        {canShowAwards ? <section className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "1.25rem", borderBottom: "1px solid var(--color-border)" }}>
            <h2 style={{ fontFamily: "var(--font-headline)", color: "var(--color-fg)", fontSize: "1.35rem", fontWeight: 800 }}>Top Projects</h2>
          </div>
          {topRows.length === 0 ? (
            <div style={{ padding: "1.5rem", color: "var(--color-muted)" }}>Ranked projects will appear here after judging is complete.</div>
          ) : (
            <div className="flex flex-col">
              {topRows.map(({ ranking, consensus }, index) => (
                <Link
                  key={ranking.submissionId}
                  href={`/project/${ranking.submissionId}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "1rem",
                    padding: "0.875rem 1.25rem",
                    borderTop: index === 0 ? "none" : "1px solid var(--color-border)",
                    textDecoration: "none",
                    color: "inherit",
                  }}
                >
                  {/* Rank */}
                  <div
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontWeight: 800,
                      color: "var(--color-accent)",
                      fontSize: "0.9375rem",
                      minWidth: "2rem",
                      flexShrink: 0,
                    }}
                  >
                    #{ranking.rank ?? "—"}
                  </div>

                  {/* Project + team */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 700,
                        color: "var(--color-fg)",
                        fontSize: "0.9375rem",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {ranking.projectTitle ?? ranking.teamName}
                    </div>
                    <div style={{ color: "var(--color-muted)", fontSize: "0.8125rem", marginTop: "0.125rem" }}>
                      {ranking.teamName}
                    </div>
                    <div style={{ marginTop: (awardBadgeMap[ranking.submissionId]?.length ?? 0) > 0 ? "0.45rem" : 0 }}>
                      <AwardBadges badges={awardBadgeMap[ranking.submissionId] ?? []} />
                    </div>
                  </div>

                  {/* Score chips */}
                  <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                    {ranking.officialScore !== null && (
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontWeight: 700,
                          fontSize: "0.8125rem",
                          color: "var(--color-fg)",
                          background: "var(--color-surface-2)",
                          border: "1px solid var(--color-border)",
                          borderRadius: 6,
                          padding: "0.2rem 0.5rem",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {ranking.officialScore}/100
                      </span>
                    )}
                    {consensus && (
                      <span
                        className="hidden sm:inline"
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontWeight: 600,
                          fontSize: "0.75rem",
                          color: "var(--color-subtle)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        AI {consensus.averageOverall}/100
                      </span>
                    )}
                    {ranking.audienceVotes > 0 && (
                      <span
                        style={{
                          fontSize: "0.75rem",
                          color: "var(--color-subtle)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        ❤ {ranking.audienceVotes}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section> : <ParticipantEmptyState className="card" title="Results aren’t published yet" description="Check back after judging is complete. You can still explore public projects or continue your own work." action={{ href: "/projects", label: "Explore projects", primary: false }} secondaryAction={{ href: "/account/projects", label: "My Projects", primary: false }} />}
      </main>
    </div>
  );
}

function AwardCard({ award, featured, badges }: { award: Award; featured: boolean; badges: Parameters<typeof AwardBadges>[0]["badges"] }) {
  return (
    <article className="card" style={{ padding: 0, overflow: "hidden", border: featured ? "1px solid var(--color-accent)" : "1px solid var(--color-border)", boxShadow: featured ? "0 24px 80px color-mix(in srgb, var(--color-accent) 18%, transparent)" : undefined }}>
      {award.screenshotUrl ? (
        <div style={{ aspectRatio: "16/9", background: "var(--color-surface-2)", overflow: "hidden" }}>
          <img src={award.screenshotUrl} alt={award.projectTitle ?? award.teamName} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        </div>
      ) : (
        <div style={{ aspectRatio: "16/9", background: "linear-gradient(135deg, color-mix(in srgb, var(--color-accent) 22%, transparent), var(--color-surface-2))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "3rem" }}>{award.icon}</div>
      )}
      <div style={{ padding: "1.25rem" }}>
        <div className="flex items-center justify-between gap-3 flex-wrap" style={{ marginBottom: "0.75rem" }}>
          <div className="flex items-center gap-2">
            <span style={{ fontSize: "1.75rem" }}>{award.icon}</span>
            <div>
              <h2 style={{ fontFamily: "var(--font-headline)", color: "var(--color-fg)", fontSize: featured ? "1.55rem" : "1.25rem", fontWeight: 800, letterSpacing: "-0.03em" }}>{award.title}</h2>
              {award.experimental && <span className="badge badge-warning" style={{ fontSize: "0.65rem" }}>Experimental</span>}
            </div>
          </div>
          <span className="badge badge-default">{award.source}</span>
        </div>
        <Link href={`/project/${award.submissionId}`} style={{ color: "var(--color-fg)", fontSize: featured ? "1.35rem" : "1.1rem", fontWeight: 800, textDecoration: "none" }}>{award.projectTitle ?? award.teamName}</Link>
        <div style={{ color: "var(--color-muted)", fontSize: "0.875rem", marginTop: "0.2rem" }}>{award.teamName}</div>
        <div style={{ marginTop: badges && badges.length > 0 ? "0.75rem" : 0 }}>
          <AwardBadges badges={badges} prominence={featured ? "prominent" : "compact"} />
        </div>
        <div className="flex items-end justify-between gap-4" style={{ marginTop: "1rem" }}>
          <p style={{ color: "var(--color-muted)", lineHeight: 1.6, fontSize: "0.875rem", margin: 0, flex: 1 }}>{award.description ?? "Award computed from current event data."}</p>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontFamily: "var(--font-headline)", color: "var(--color-accent)", fontWeight: 900, fontSize: "1.75rem", lineHeight: 1 }}>{award.metricValue}</div>
            <div style={{ color: "var(--color-subtle)", fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>{award.metricLabel}</div>
          </div>
        </div>
        {award.highlights.length > 0 && (
          <div className="flex flex-wrap gap-2" style={{ marginTop: "1rem" }}>
            {award.highlights.map((highlight) => <span key={highlight} className="badge badge-2" style={{ fontSize: "0.7rem" }}>{highlight}</span>)}
          </div>
        )}
        <div className="flex gap-2 flex-wrap" style={{ marginTop: "1rem" }}>
          <Link href={`/project/${award.submissionId}`} className="btn-primary" style={{ flex: 1, justifyContent: "center" }}>View Project</Link>
          {award.demoVideoUrl && (
            <a href={award.demoVideoUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary" style={{ justifyContent: "center", whiteSpace: "nowrap" }}>▶ Demo Available</a>
          )}
        </div>
      </div>
    </article>
  );
}
