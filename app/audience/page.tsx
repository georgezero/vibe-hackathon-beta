export const dynamic = "force-dynamic";

import Link from "next/link";
import { NavPublic } from "@/components/NavPublic";
import { db } from "@/lib/db";
import { submissions, audienceVotes } from "@/lib/db/schema";
import { inArray, sql, type InferSelectModel } from "drizzle-orm";
import { audienceVotingStatus, getActiveEvent } from "@/lib/events";
import { getEventBranding } from "@/lib/event-branding";
import { getAwardBadgeMap } from "@/lib/award-badges";
import { AwardBadges } from "@/components/AwardBadges";
import { EventFreezeBanner } from "@/components/EventFreezeBanner";

type Sub = InferSelectModel<typeof submissions>;
type VoteCountRow = { submissionId: string; count: number };

export default async function AudiencePage() {
  const [event, branding, awardBadgeMap] = await Promise.all([getActiveEvent(), getEventBranding(), getAwardBadgeMap()]);
  const voting = audienceVotingStatus(event);

  const subRows: Sub[] = await db
    .select()
    .from(submissions)
    .where(inArray(submissions.status, ["submitted", "finalized"]));

  let standings: { id: string; projectTitle: string | null; teamName: string; votes: number }[] = [];

  if (voting.resultsVisible && subRows.length > 0) {
    const ids = subRows.map((s: Sub) => s.id);
    const voteRows: VoteCountRow[] = await db
      .select({ submissionId: audienceVotes.submissionId, count: sql<number>`cast(count(*) as integer)` })
      .from(audienceVotes)
      .where(inArray(audienceVotes.submissionId, ids))
      .groupBy(audienceVotes.submissionId);
    const voteMap = Object.fromEntries(voteRows.map((v: VoteCountRow) => [v.submissionId, v.count]));
    standings = subRows
      .map((s: Sub) => ({ id: s.id, projectTitle: s.projectTitle, teamName: s.teamName, votes: voteMap[s.id] ?? 0 }))
      .sort((a, b) => b.votes - a.votes);
  }

  const maxVotes = standings[0]?.votes ?? 1;

  return (
    <div className="flex flex-col min-h-screen">
      <NavPublic />
      <EventFreezeBanner />

      <div className="mx-auto max-w-2xl w-full px-4 sm:px-6 py-12 flex-1">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <span className="badge badge-default">{branding.eventName}</span>
            <span
              className="badge"
              style={{
                background: voting.open
                  ? "color-mix(in srgb, var(--color-success) 15%, transparent)"
                  : "color-mix(in srgb, var(--color-muted) 15%, transparent)",
                color: voting.open ? "var(--color-success)" : "var(--color-muted)",
              }}
            >
              {voting.open ? "Voting open" : "Voting closed"}
            </span>
          </div>
          <h1
            style={{
              fontFamily: "var(--font-headline)",
              fontSize: "clamp(1.75rem, 4vw, 2.5rem)",
              fontWeight: 700,
              letterSpacing: "-0.03em",
              color: "var(--color-fg)",
              marginBottom: "0.5rem",
            }}
          >
            People&apos;s Choice
          </h1>
          <p style={{ color: "var(--color-muted)", fontSize: "0.9375rem" }}>
            Audience vote standings for {branding.eventName}
          </p>
        </div>

        {!voting.resultsVisible ? (
          <div
            className="card"
            style={{ padding: "3rem 2rem", textAlign: "center" }}
          >
            <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>🗳️</div>
            <div
              style={{
                fontWeight: 600,
                color: "var(--color-fg)",
                fontSize: "1.125rem",
                marginBottom: "0.5rem",
              }}
            >
              Voting is open
            </div>
            <p style={{ color: "var(--color-muted)", fontSize: "0.9375rem", lineHeight: 1.65 }}>
              Results will be revealed after voting closes.
            </p>
            {voting.open && (
              <Link href="/projects" className="btn-primary" style={{ marginTop: "1.5rem", display: "inline-flex", justifyContent: "center" }}>
                Cast your vote →
              </Link>
            )}
          </div>
        ) : standings.length === 0 ? (
          <div className="card" style={{ padding: "3rem 2rem", textAlign: "center" }}>
            <p style={{ color: "var(--color-muted)" }}>No votes yet.</p>
            {voting.open && (
              <Link href="/projects" className="btn-secondary" style={{ marginTop: "1rem", display: "inline-flex", justifyContent: "center" }}>
                Be the first to vote →
              </Link>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {standings.map((entry, i) => (
              <div
                key={entry.id}
                className="card"
                style={{
                  padding: "1rem 1.25rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "1rem",
                  border: i === 0 ? "1px solid var(--color-accent)" : undefined,
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontWeight: 700,
                    fontSize: "1.25rem",
                    color: i === 0 ? "var(--color-warning)" : "var(--color-subtle)",
                    minWidth: "2rem",
                    textAlign: "center",
                    flexShrink: 0,
                  }}
                >
                  {i === 0 ? "❤️" : `#${i + 1}`}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Link
                    href={`/project/${entry.id}`}
                    style={{ fontWeight: 600, color: "var(--color-fg)", fontSize: "0.9375rem", textDecoration: "none" }}
                  >
                    {entry.projectTitle ?? entry.teamName}
                  </Link>
                  <div style={{ fontSize: "0.75rem", color: "var(--color-muted)", marginTop: "0.25rem" }}>
                    {entry.teamName}
                  </div>
                  <div style={{ marginTop: (awardBadgeMap[entry.id]?.length ?? 0) > 0 ? "0.5rem" : 0 }}>
                    <AwardBadges badges={awardBadgeMap[entry.id] ?? []} />
                  </div>
                  <div
                    style={{
                      marginTop: "0.5rem",
                      height: 4,
                      background: "var(--color-surface-2)",
                      borderRadius: 999,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${(entry.votes / maxVotes) * 100}%`,
                        height: "100%",
                        background: i === 0 ? "var(--color-accent)" : "var(--color-muted)",
                        borderRadius: 999,
                        transition: "width 400ms",
                      }}
                    />
                  </div>
                </div>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontWeight: 700,
                    color: i === 0 ? "var(--color-accent)" : "var(--color-fg)",
                    fontSize: "1.125rem",
                    flexShrink: 0,
                  }}
                >
                  {entry.votes}
                </span>
              </div>
            ))}

            {voting.open && (
              <div style={{ marginTop: "0.5rem", textAlign: "center" }}>
                <Link href="/projects" className="btn-secondary" style={{ display: "inline-flex", justifyContent: "center" }}>
                  Browse projects →
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
