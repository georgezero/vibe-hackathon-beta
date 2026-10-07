export const dynamic = "force-dynamic";

import { NavPublic } from "@/components/NavPublic";
import { db } from "@/lib/db";
import { submissions, audienceVotes } from "@/lib/db/schema";
import { inArray, sql, type InferSelectModel } from "drizzle-orm";
import { audienceVotingStatus, getActiveEvent } from "@/lib/events";
import { getEventBranding } from "@/lib/event-branding";
import GalleryClient, { type GallerySubmission } from "./GalleryClient";
import { getAwardBadgeMap } from "@/lib/award-badges";
import { EventFreezeBanner } from "@/components/EventFreezeBanner";

type Sub = InferSelectModel<typeof submissions>;
type VoteCountRow = { submissionId: string; count: number };

const IDENTITY_INSTRUCTION: Record<string, string> = {
  badge: "One vote per badge number.",
  email: "One vote per email address.",
  invite_code: "One vote per invite code.",
  anonymous: "One vote per device.",
};

export default async function ProjectsPage() {
  const [activeEvent, branding, awardBadgeMap] = await Promise.all([
    getActiveEvent(),
    getEventBranding(),
    getAwardBadgeMap(),
  ]);
  const voting = audienceVotingStatus(activeEvent);

  const subRows: Sub[] = await db
    .select()
    .from(submissions)
    .where(inArray(submissions.status, ["submitted", "finalized"]));

  let voteCounts: Record<string, number> = {};
  if (subRows.length > 0) {
    const ids = subRows.map((s: Sub) => s.id);
    const voteRows: VoteCountRow[] = await db
      .select({
        submissionId: audienceVotes.submissionId,
        count: sql<number>`cast(count(*) as integer)`,
      })
      .from(audienceVotes)
      .where(inArray(audienceVotes.submissionId, ids))
      .groupBy(audienceVotes.submissionId);
    voteCounts = Object.fromEntries(
      voteRows.map((v: VoteCountRow) => [v.submissionId, v.count])
    );
  }

  const gallerySubmissions: GallerySubmission[] = subRows.map((s: Sub) => ({
    id: s.id,
    projectTitle: s.projectTitle,
    teamName: s.teamName,
    problemStatement: s.problemStatement,
    demoUrl: s.demoUrl,
    demoVideoUrl: s.demoVideoUrl,
    githubUrl: s.githubUrl,
    screenshotUrl: s.screenshotUrl,
    status: s.status,
    tags: s.tags as string[] | null,
    audienceVotes: voting.resultsVisible ? voteCounts[s.id] ?? 0 : null,
    awardBadges: awardBadgeMap[s.id] ?? [],
  }));

  const voteInstruction = IDENTITY_INSTRUCTION[voting.identityMethod] ?? "One vote per attendee.";

  return (
    <div className="flex flex-col min-h-screen">
      <NavPublic />
      <EventFreezeBanner />

      <div className="mx-auto max-w-7xl w-full px-4 sm:px-6 py-12 flex-1">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <span className="badge badge-default">{branding.eventName}</span>
          </div>
          <h1
            style={{
              fontFamily: "var(--font-headline)",
              fontSize: "clamp(1.75rem, 4vw, 2.75rem)",
              fontWeight: 700,
              letterSpacing: "-0.03em",
              color: "var(--color-fg)",
              marginBottom: "0.375rem",
            }}
          >
            Projects
          </h1>
          <p style={{ color: "var(--color-muted)", fontSize: "0.9375rem" }}>
            {gallerySubmissions.length} project{gallerySubmissions.length !== 1 ? "s" : ""}
          </p>
        </div>

        {/* People's Choice voting banner */}
        {voting.open && (
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: "1rem",
              padding: "1rem 1.25rem",
              marginBottom: "2rem",
              borderRadius: 12,
              border: "1px solid color-mix(in srgb, var(--color-accent) 35%, transparent)",
              background: "color-mix(in srgb, var(--color-accent) 8%, transparent)",
              flexWrap: "wrap",
            }}
          >
            <div>
              <div style={{ fontWeight: 700, color: "var(--color-fg)", fontSize: "1rem", marginBottom: "0.25rem" }}>
                🏆 People&apos;s Choice Voting Open
              </div>
              <div style={{ color: "var(--color-muted)", fontSize: "0.875rem" }}>
                Vote for your favorite project. {voteInstruction}
              </div>
            </div>
            <a
              href="/audience"
              style={{ fontSize: "0.8125rem", color: "var(--color-accent)", fontWeight: 600, textDecoration: "none", whiteSpace: "nowrap", flexShrink: 0, paddingTop: "0.125rem" }}
            >
              View standings →
            </a>
          </div>
        )}

        {!voting.open && voting.resultsVisible && (
          <a
            href="/audience"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0.75rem 1.125rem",
              marginBottom: "2rem",
              borderRadius: 10,
              border: "1px solid var(--color-border)",
              background: "var(--color-surface-2)",
              textDecoration: "none",
              color: "var(--color-fg)",
              fontSize: "0.875rem",
              fontWeight: 500,
            }}
          >
            <span>🏆 People&apos;s Choice standings</span>
            <span style={{ color: "var(--color-accent)" }}>View →</span>
          </a>
        )}

        <GalleryClient
          submissions={gallerySubmissions}
          votingOpen={voting.open}
          resultsVisible={voting.resultsVisible}
          identityMethod={voting.identityMethod}
          votingMode={voting.votingMode}
        />
      </div>
    </div>
  );
}
