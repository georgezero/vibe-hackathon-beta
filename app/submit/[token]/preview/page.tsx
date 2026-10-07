export const dynamic = "force-dynamic";

import Link from "next/link";
import { NavPublic } from "@/components/NavPublic";
import { db } from "@/lib/db";
import { submissions, teamMembers } from "@/lib/db/schema";
import { getActiveEvent, submissionDeadlineStatus } from "@/lib/events";
import { getEventBranding } from "@/lib/event-branding";
import { resolveScreenshotUrls } from "@/lib/screenshots";
import { submissionLinks } from "@/lib/submission-links";
import { eq } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";
import { HeroScreenshot } from "@/app/project/[id]/HeroScreenshot";
import { VideoEmbed } from "@/app/project/[id]/VideoEmbed";
import { PreviewActions } from "./PreviewActions";
import { AwardBadges } from "@/components/AwardBadges";
import { getAwardBadgesForSubmission } from "@/lib/award-badges";
import { AgentCompletionPrompt } from "@/components/AgentCompletionPrompt";
import { getBaseUrl } from "@/lib/base-url";
import { computeSubmissionReadiness } from "@/lib/submission-readiness";
import { TeamSummaryCard } from "@/components/TeamSummaryCard";
import { EventFreezeBanner } from "@/components/EventFreezeBanner";
import { isSubmittedStatus, participantSubmissionState } from "@/lib/submission-finalization";
import { fieldTargetForReadiness } from "@/lib/project-editor";
import { recordParticipantJourneyEvent } from "@/lib/participant-experience";

interface Props {
  params: Promise<{ token: string }>;
}

type ChecklistItem = {
  label: string;
  complete: boolean;
  note?: string;
};
type TeamMember = InferSelectModel<typeof teamMembers>;

function statusClass(status: string) {
  if (status === "locked") return "badge-default";
  if (status === "submitted" || status === "finalized") return "badge-success";
  return "badge-warning";
}

function statusLabel(status: string) {
  if (status === "submitted" || status === "finalized") return "Submitted";
  if (status === "locked") return "Locked";
  return "Draft";
}

function readinessLabel(complete: number, total: number) {
  if (complete === total) return "Ready";
  if (complete >= Math.ceil(total * 0.55)) return "Partial";
  return "Needs attention";
}

function readinessClass(label: string) {
  if (label === "Ready") return "badge-success";
  if (label === "Partial") return "badge-warning";
  return "badge-default";
}

function textPresent(value: string | null | undefined, minLength = 1) {
  return Boolean(value && value.trim().length >= minLength);
}

export default async function SubmissionPreviewPage({ params }: Props) {
  const { token } = await params;

  const rows = await db.select().from(submissions).where(eq(submissions.editToken, token));
  const sub = rows[0] ?? null;

  if (!sub) {
    return (
      <div className="flex flex-col min-h-screen">
        <NavPublic />
        <EventFreezeBanner />
        <main className="mx-auto max-w-2xl w-full px-4 sm:px-6 py-16 flex-1">
          <div className="card" style={{ padding: "2rem", textAlign: "center" }}>
            <span className="badge badge-default">Invalid preview link</span>
            <h1 style={{ fontFamily: "var(--font-headline)", fontSize: "2rem", color: "var(--color-fg)", marginTop: "1rem", marginBottom: "0.75rem" }}>
              Project preview not found
            </h1>
            <p style={{ color: "var(--color-muted)", lineHeight: 1.6 }}>
              This private preview link is invalid or the project no longer exists. Check the private project link provided when the draft was created.
            </p>
          </div>
        </main>
      </div>
    );
  }

  const [memberRows, event, branding] = await Promise.all([
    db.select().from(teamMembers).where(eq(teamMembers.submissionId, sub.id)).orderBy(teamMembers.order),
    getActiveEvent(),
    getEventBranding(),
  ]);
  const members = memberRows as TeamMember[];
  const awardBadges = await getAwardBadgesForSubmission(sub.id, { event });

  const deadline = submissionDeadlineStatus(event);
  const links = submissionLinks(token, sub.id);
  const screenshots = resolveScreenshotUrls(sub);
  const tags = (sub.tags as string[] | null) ?? [];
  const harnesses = (sub.agentHarnesses as string[] | null) ?? [];
  const models = (sub.agentModels as string[] | null) ?? [];
  const readinessResult = computeSubmissionReadiness(sub, members.map((member) => ({ name: member.name, badgeNumber: member.badgeNumber, isStudentTrainee: member.isStudentTrainee })));
  void recordParticipantJourneyEvent({ eventId: event.id, eventType: "participant_preview_viewed", deviceClass: "unknown", destination: "preview", context: "preview", outcome: "viewed" });
  void recordParticipantJourneyEvent({ eventId: event.id, eventType: readinessResult.missingRequiredItems.length ? "participant_readiness_incomplete" : "participant_readiness_complete", deviceClass: "unknown", destination: "preview", context: "preview", outcome: readinessResult.missingRequiredItems.length ? "guardrail" : "success", reason: readinessResult.missingRequiredItems.length ? "readiness_incomplete" : undefined });
  const submissionState = participantSubmissionState(sub.status);
  const isSubmitted = isSubmittedStatus(sub.status);
  const canFinalize = submissionState.canEditBeforeDeadline && deadline.open && !event.isFrozen && readinessResult.missingRequiredItems.length === 0;
  const teamSummary = readinessResult.teamEligibility;
  const required: ChecklistItem[] = readinessResult.requiredItems.map((item) => ({ label: item.label, complete: item.complete, note: item.note }));

  const evidence: ChecklistItem[] = [
    { label: "GitHub URL", complete: textPresent(sub.githubUrl), note: sub.githubUrl ?? "Missing" },
    { label: "README expected", complete: textPresent(sub.readmeUrl), note: sub.readmeUrl ? "README URL provided" : "Add README URL or ensure repo has README.md" },
    { label: "AGENTS.md expected", complete: textPresent(sub.agentsMdUrl), note: sub.agentsMdUrl ? "AGENTS.md URL provided" : "Add AGENTS.md URL" },
    { label: "vibe.json", complete: textPresent(sub.vibeJsonRaw), note: sub.vibeJsonRaw ? "Captured from agent-native submission" : "Recommended for agent-native submissions" },
    { label: "docs/vibe-submission.md", complete: false, note: "Recommended judging artifact if present in repo" },
    { label: "docs/agent-report.md", complete: textPresent(sub.agentReportUrl) || textPresent(sub.agentReportRaw), note: "Recommended agent evidence" },
    { label: "Screenshots", complete: screenshots.length > 0, note: `${screenshots.length} screenshot${screenshots.length === 1 ? "" : "s"}` },
    { label: "Demo video", complete: textPresent(sub.demoVideoUrl), note: sub.demoVideoUrl ? "Provided" : "Optional but useful for demos" },
    { label: "Prompt notes", complete: textPresent(sub.promptStrategyUrl), note: sub.promptStrategyUrl ? "Provided" : "Recommended docs/prompts.md" },
  ];

  const completeRequired = required.filter((item) => item.complete).length;
  const completeEvidence = evidence.filter((item) => item.complete).length;
  const readiness = readinessLabel(completeEvidence, evidence.length);
  const missingFields = readinessResult.missingRequiredItems.map((item) => item.label);
  const weakFields = required.filter((item) => item.complete && item.note).map((item) => `${item.label}: ${item.note}`);
  const heroUrl = screenshots[0] ?? null;

  return (
    <div className="flex flex-col min-h-screen">
      <NavPublic />
      <EventFreezeBanner />
      <main className="mx-auto max-w-7xl w-full px-4 sm:px-6 py-8 sm:py-12 flex-1">
        <div className="mb-6">
          <Link href={`/submit/${token}`} style={{ color: "var(--color-subtle)", fontSize: "0.8125rem", textDecoration: "none" }}>
            ← Back to project form
          </Link>
        </div>

        <section className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 mb-8">
          <div className="card" style={{ padding: "1.5rem" }}>
            <div className="flex flex-wrap gap-2 mb-4">
              <span className={`badge ${statusClass(sub.status)}`}>{statusLabel(sub.status)}</span>
              <span className="badge badge-default">Judge-facing preview</span>
              <span className={`badge ${deadline.open ? "badge-success" : "badge-default"}`}>{deadline.label}</span>
            </div>
            <h1 style={{ fontFamily: "var(--font-headline)", fontSize: "clamp(2rem, 5vw, 4rem)", lineHeight: 0.95, fontWeight: 900, letterSpacing: "-0.06em", color: "var(--color-fg)", marginBottom: "1rem" }}>
              {sub.projectTitle || "Untitled project"}
            </h1>
            <p style={{ color: "var(--color-muted)", fontSize: "1rem", lineHeight: 1.7 }}>
              by <strong style={{ color: "var(--color-fg)" }}>{sub.teamName}</strong>
              {members.length ? ` · ${(members as TeamMember[]).map((m) => m.name).join(", ")}` : ""}
            </p>
            <div style={{ marginTop: awardBadges.length > 0 ? "1rem" : 0 }}>
              <AwardBadges badges={awardBadges} prominence="prominent" />
            </div>
          </div>

          <div className="card" style={{ padding: "1.25rem" }}>
            <h2 style={{ color: "var(--color-fg)", fontWeight: 800, marginBottom: "0.75rem" }}>Review actions</h2>
            <div className="flex flex-col gap-2 mb-4">
              <Link href={`/submit/${token}`} className="btn-secondary" style={{ justifyContent: "center" }}>Edit project</Link>
            </div>
            <PreviewActions
              submissionId={sub.id}
              token={token}
              editUrl={links.edit_url}
              previewUrl={links.preview_url}
              canFinalize={canFinalize}
              isSubmitted={isSubmitted}
              missingFields={missingFields}
              weakFields={weakFields}
            />
            <div style={{ marginTop: "1rem" }}>
              <AgentCompletionPrompt
                submissionId={sub.id}
                editToken={token}
                editUrl={links.edit_url}
                previewUrl={links.preview_url}
                finalizeUrl={links.finalize_url}
                baseUrl={getBaseUrl()}
                missingFields={missingFields}
                weakFields={weakFields}
                compact
                title="Copy Agent Revision Prompt"
              />
            </div>
          </div>
        </section>

        <section className="card" aria-labelledby="readiness-heading" style={{ padding: "1.25rem", marginBottom: "1.5rem", borderColor: readinessResult.missingRequiredItems.length === 0 ? "var(--color-success)" : "var(--color-warning)" }}>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p style={{ color: "var(--color-accent)", fontSize: "0.68rem", fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase" }}>Submission readiness</p>
              <h2 id="readiness-heading" style={{ color: "var(--color-fg)", fontWeight: 850, fontSize: "1.35rem", marginTop: "0.25rem" }}>
                {isSubmitted ? "Submitted for judging" : readinessResult.missingRequiredItems.length === 0 ? "Ready to submit" : "Not ready to submit"}
              </h2>
              <p style={{ color: "var(--color-muted)", lineHeight: 1.55, marginTop: "0.35rem" }}>
                {isSubmitted
                  ? "This project is marked for judging. Before the deadline, you can update it and submit a new version."
                  : readinessResult.missingRequiredItems.length === 0
                    ? "Everything required for judging is complete. Review the project below before you submit."
                    : `${readinessResult.missingRequiredItems.length} required ${readinessResult.missingRequiredItems.length === 1 ? "item is" : "items are"} missing. Use the project form to complete them.`}
              </p>
            </div>
            {!isSubmitted && <span className={`badge ${readinessResult.missingRequiredItems.length === 0 ? "badge-success" : "badge-warning"}`}>
              {readinessResult.completeCount}/{readinessResult.totalCount} required
            </span>}
          </div>
          {readinessResult.missingRequiredItems.length > 0 && <ul style={{ margin: "0.9rem 0 0", paddingLeft: "1.1rem", color: "var(--color-muted)", lineHeight: 1.6, fontSize: "0.84rem" }}>
            {readinessResult.missingRequiredItems.slice(0, 6).map((item) => {
              const target = fieldTargetForReadiness(item.key);
              return <li key={item.key}><Link href={`/submit/${token}${target ? `#section-${target}` : ""}`} style={{ color: "var(--color-accent)" }}>{item.label}</Link>{item.note ? ` — ${item.note}` : ""}</li>;
            })}
            {readinessResult.missingRequiredItems.length > 6 && <li>+{readinessResult.missingRequiredItems.length - 6} more required items</li>}
          </ul>}
        </section>

        <section className="card" aria-labelledby="eligibility-heading" style={{ padding: "1.25rem", marginBottom: "1.5rem" }}>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p style={{ color: "var(--color-accent)", fontSize: "0.68rem", fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase" }}>Prize eligibility</p>
              <h2 id="eligibility-heading" style={{ color: "var(--color-fg)", fontWeight: 800, fontSize: "1.15rem", marginTop: "0.25rem" }}>{teamSummary.eligibleForPrize ? "Eligible for prizes" : "Needs attention"}</h2>
              <p style={{ color: "var(--color-muted)", lineHeight: 1.55, marginTop: "0.35rem" }}>
                {teamSummary.eligibleForPrize
                  ? `${teamSummary.badgeCount} of ${teamSummary.memberCount} team badge numbers are on file.`
                  : `You can still submit this project, but the team will not be eligible for prizes until ${teamSummary.missingMembers.length === 1 ? `${teamSummary.missingMembers[0]} has` : "all listed teammates have"} a badge number.`}
              </p>
            </div>
            <span className={`badge ${teamSummary.eligibleForPrize ? "badge-success" : "badge-warning"}`}>{teamSummary.eligibleForPrize ? "Eligible" : "Not yet eligible"}</span>
          </div>
          {!teamSummary.eligibleForPrize && teamSummary.missingMembers.length > 0 && <Link href={`/submit/${token}/team`} className="btn-secondary" style={{ marginTop: "0.85rem" }}>Complete team details</Link>}
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-6 mb-8">
          <div className="card overflow-hidden">
            <div style={{ aspectRatio: "16/9", background: "var(--color-surface-2)", overflow: "hidden" }}>
              {heroUrl ? (
                <img src={heroUrl} alt={sub.projectTitle ?? "Project screenshot"} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-subtle)" }}>No screenshot yet</div>
              )}
            </div>
            <div style={{ padding: "1.125rem" }}>
              <div className="flex flex-wrap gap-1 mb-3">
                {tags.map((tag) => <span key={tag} className="badge badge-default" style={{ fontSize: "0.625rem" }}>{tag}</span>)}
              </div>
              <h2 style={{ color: "var(--color-fg)", fontWeight: 800, fontSize: "1.15rem", marginBottom: "0.25rem" }}>{sub.projectTitle || sub.teamName}</h2>
              <p style={{ color: "var(--color-muted)", fontSize: "0.8125rem", marginBottom: "0.75rem" }}>{sub.teamName}</p>
              <div style={{ marginBottom: awardBadges.length > 0 ? "0.75rem" : 0 }}>
                <AwardBadges badges={awardBadges} />
              </div>
              <p style={{ color: "var(--color-subtle)", fontSize: "0.8125rem", lineHeight: 1.55, marginBottom: "1rem" }}>{sub.problemStatement || "No problem statement yet."}</p>
              <div className="flex flex-wrap gap-2 mb-4">
                {sub.demoUrl && <span className="btn-ghost" style={{ fontSize: "0.75rem", padding: "0.25rem 0.625rem" }}>↗ Demo</span>}
                {sub.githubUrl && <span className="btn-ghost" style={{ fontSize: "0.75rem", padding: "0.25rem 0.625rem" }}>GitHub</span>}
                {sub.demoVideoUrl && <span className="btn-ghost" style={{ fontSize: "0.75rem", padding: "0.25rem 0.625rem" }}>▶ Video</span>}
              </div>
              <button disabled style={{ width: "100%", padding: "0.75rem 1rem", borderRadius: 10, border: "1px dashed var(--color-border)", background: "var(--color-surface-2)", color: "var(--color-subtle)", fontWeight: 700 }}>
                Voting appears after finalization.
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <div className="card" style={{ padding: "1.25rem" }}>
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h2 style={{ fontFamily: "var(--font-headline)", color: "var(--color-fg)", fontSize: "1.25rem", fontWeight: 800 }}>Project preview</h2>
                  <p style={{ color: "var(--color-muted)", fontSize: "0.78rem", lineHeight: 1.5, marginTop: "0.25rem" }}>Review the project details and team information organizers and judges will use after you submit.</p>
                </div>
                <span className="badge badge-default">{branding.eventName}</span>
              </div>
              <HeroScreenshot screenshotUrls={screenshots} alt={sub.projectTitle ?? sub.teamName} />
              {sub.demoVideoUrl && (
                <div style={{ marginTop: "1rem" }}>
                  <VideoEmbed url={sub.demoVideoUrl} title={`${sub.projectTitle ?? sub.teamName} demo video`} />
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4" style={{ marginTop: "1rem" }}>
                <InfoCard title="Problem statement" value={sub.problemStatement} />
                <InfoCard title="Target users" value={sub.targetUsers} />
                <InfoCard title="Agent-native metadata" value={[
                  harnesses.length ? `Harnesses: ${harnesses.join(", ")}` : "Harnesses not reported",
                  models.length ? `Models: ${models.join(", ")}` : "Models not reported",
                  sub.budgetTier ? `Budget: ${sub.budgetTier}` : "Budget not reported",
                ].join("\n")} />
                <InfoCard title="Repository links" value={[
                  sub.githubUrl ? `GitHub: ${sub.githubUrl}` : "GitHub missing",
                  sub.readmeUrl ? `README: ${sub.readmeUrl}` : "README URL missing",
                  sub.agentsMdUrl ? `AGENTS.md: ${sub.agentsMdUrl}` : "AGENTS.md URL missing",
                ].join("\n")} />
              </div>
            </div>
          </div>
        </section>

        <section style={{ marginBottom: "1.5rem" }}>
          <TeamSummaryCard token={token} summary={teamSummary} />
          <div className="card" style={{ padding: "1.25rem", marginTop: "1rem" }}>
            <div className="flex items-start justify-between gap-3 flex-wrap" style={{ marginBottom: "1rem" }}>
              <div>
                <h2 style={{ color: "var(--color-fg)", fontWeight: 850, fontSize: "1.2rem" }}>Your team</h2>
                <p style={{ color: "var(--color-muted)", fontSize: "0.8125rem" }}>Private preview only. This information is not shown on public project pages.</p>
              </div>
              <Link href={`/submit/${token}/team`} className="btn-secondary">Manage Team</Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {(members as TeamMember[]).map((member, index) => (
                <div key={member.id} style={{ border: "1px solid var(--color-border)", background: "var(--color-surface-2)", borderRadius: 10, padding: "0.875rem" }}>
                  <div style={{ color: "var(--color-fg)", fontWeight: 750 }}>{member.name} {index === 0 ? <span className="badge badge-default" style={{ marginLeft: "0.35rem" }}>Team lead</span> : null}</div>
                  <div style={{ color: "var(--color-muted)", fontSize: "0.75rem", marginTop: "0.25rem" }}>{member.affiliation || "Affiliation not provided"} · {member.degrees || "Degrees not provided"}</div>
                  <div style={{ color: member.badgeNumber ? "var(--color-success)" : "var(--color-warning)", fontSize: "0.75rem", marginTop: "0.35rem" }}>
                    {member.badgeNumber ? "Badge on file" : "Missing badge number"}{member.isStudentTrainee ? " · Student/trainee" : ""}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChecklistCard
            title="AI Eval Readiness"
            subtitle="Evidence AI evaluators will receive. This does not predict scores."
            badge={readiness}
            badgeClass={readinessClass(readiness)}
            items={evidence}
          />
          <ChecklistCard
            title="Required project details"
            subtitle={`${completeRequired}/${required.length} complete before final review.`}
            badge={`${completeRequired}/${required.length}`}
            badgeClass={completeRequired === required.length ? "badge-success" : "badge-warning"}
            items={required}
          />
        </section>
      </main>
    </div>
  );
}

function InfoCard({ title, value }: { title: string; value: string | null | undefined }) {
  return (
    <div style={{ border: "1px solid var(--color-border)", background: "var(--color-surface-2)", borderRadius: 10, padding: "1rem" }}>
      <h3 style={{ color: "var(--color-fg)", fontWeight: 700, fontSize: "0.875rem", marginBottom: "0.5rem" }}>{title}</h3>
      <p style={{ whiteSpace: "pre-line", color: "var(--color-muted)", fontSize: "0.8125rem", lineHeight: 1.65 }}>{value || "Not provided yet."}</p>
    </div>
  );
}

function ChecklistCard({ title, subtitle, badge, badgeClass, items }: { title: string; subtitle: string; badge: string; badgeClass: string; items: ChecklistItem[] }) {
  return (
    <div className="card" style={{ padding: "1.25rem" }}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 style={{ color: "var(--color-fg)", fontWeight: 800, fontSize: "1.1rem", marginBottom: "0.25rem" }}>{title}</h2>
          <p style={{ color: "var(--color-subtle)", fontSize: "0.8125rem" }}>{subtitle}</p>
        </div>
        <span className={`badge ${badgeClass}`}>{badge}</span>
      </div>
      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <div key={item.label} style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start", padding: "0.75rem", borderRadius: 10, background: "var(--color-surface-2)", border: "1px solid var(--color-border)" }}>
            <span style={{ color: item.complete ? "var(--color-success)" : "var(--color-warning)", fontWeight: 900, width: 18 }}>{item.complete ? "✓" : "!"}</span>
            <div>
              <div style={{ color: "var(--color-fg)", fontSize: "0.875rem", fontWeight: 650 }}>{item.label}</div>
              {item.note && <div style={{ color: "var(--color-subtle)", fontSize: "0.75rem", lineHeight: 1.45, marginTop: "0.125rem" }}>{item.note}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
