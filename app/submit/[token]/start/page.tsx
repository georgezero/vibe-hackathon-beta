export const dynamic = "force-dynamic";

import Link from "next/link";
import { NavPublic } from "@/components/NavPublic";
import { db } from "@/lib/db";
import { submissions } from "@/lib/db/schema";
import { teamMembers } from "@/lib/db/schema";
import { submissionLinks } from "@/lib/submission-links";
import { getBaseUrl } from "@/lib/base-url";
import { eq } from "drizzle-orm";
import { computePrizeEligibility } from "@/lib/prize-eligibility";
import { TeamSummaryCard } from "@/components/TeamSummaryCard";
import type { InferSelectModel } from "drizzle-orm";
import { TeamPromptSwitcher } from "./TeamPromptSwitcher";
import { EventFreezeBanner } from "@/components/EventFreezeBanner";
import { ClaimDraftCard } from "./ClaimDraftCard";

type TeamMember = InferSelectModel<typeof teamMembers>;

interface Props {
  params: Promise<{ token: string }>;
}

export default async function SubmissionStartPage({ params }: Props) {
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
            <span className="badge badge-default">Invalid edit link</span>
            <h1 style={{ fontFamily: "var(--font-headline)", color: "var(--color-fg)", fontSize: "2rem", marginTop: "1rem" }}>Draft not found</h1>
            <p style={{ color: "var(--color-muted)", lineHeight: 1.6, marginTop: "0.75rem" }}>Check the private link returned after team registration.</p>
          </div>
        </main>
      </div>
    );
  }

  const links = submissionLinks(token, sub.id);
  const finalized = sub.status === "submitted" || sub.status === "finalized" || sub.status === "locked";
  const members: TeamMember[] = await db.select().from(teamMembers).where(eq(teamMembers.submissionId, sub.id)).orderBy(teamMembers.order);
  const teamSummary = computePrizeEligibility(members.map((member) => ({ name: member.name, badgeNumber: member.badgeNumber, isStudentTrainee: member.isStudentTrainee })));

  return (
    <div className="flex flex-col min-h-screen">
      <NavPublic />
      <EventFreezeBanner />
      <main className="mx-auto max-w-6xl w-full px-4 sm:px-6 py-10 sm:py-14 flex-1">
        <div style={{ marginBottom: "1.5rem" }}>
          <span className={`badge ${finalized ? "badge-success" : "badge-warning"}`}>{finalized ? "Submitted" : "Private project"}</span>
          <h1 style={{ fontFamily: "var(--font-headline)", color: "var(--color-fg)", fontSize: "clamp(2.2rem, 6vw, 4.8rem)", lineHeight: 0.95, fontWeight: 900, letterSpacing: "-0.06em", marginTop: "1rem", marginBottom: "1rem" }}>
            {finalized ? "Your project is submitted" : "Your project is ready"}
          </h1>
          <p style={{ color: "var(--color-muted)", fontSize: "1rem", lineHeight: 1.7, maxWidth: 760 }}>
            {finalized ? "Review the submitted project or open its project workspace." : `We created a private draft for ${sub.teamName}. Save it to My Projects or continue without an account.`}
          </p>
        </div>

        {finalized && <div className="flex flex-wrap gap-2" style={{ marginBottom: "1.5rem" }}><Link href={`/submit/${token}/preview`} className="btn-primary">Review project</Link><Link href="/account/projects" className="btn-secondary">Open My Projects</Link></div>}

        {!finalized && <ClaimDraftCard submissionId={sub.id} editToken={token} />}

        {!finalized && <section aria-labelledby="completion-choice" style={{ marginTop: "1.5rem", marginBottom: "1.5rem" }}>
          <h2 id="completion-choice" style={{ color: "var(--color-fg)", fontFamily: "var(--font-headline)", fontSize: "1.6rem", letterSpacing: "-0.03em" }}>How would you like to continue?</h2>
          <p style={{ color: "var(--color-muted)", fontSize: "0.88rem", lineHeight: 1.6, marginTop: "0.35rem", marginBottom: "1rem" }}>You can switch between these paths later. Your project stays private until you submit it.</p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="card" style={{ padding: "1.5rem" }}>
            <span className="badge badge-success">Browser path</span>
            <h3 style={{ color: "var(--color-fg)", fontWeight: 900, fontSize: "1.55rem", marginTop: "0.9rem", marginBottom: "0.6rem" }}>Fill out the project form</h3>
            <p style={{ color: "var(--color-muted)", lineHeight: 1.65, marginBottom: "1.25rem" }}>
              Complete your project details in the browser. You can add teammates and switch to a coding agent later.
            </p>
            <Link href={`/submit/${token}`} className="btn-primary" style={{ justifyContent: "center" }}>Open project form</Link>
          </div>

          <div className="card" style={{ padding: "1.5rem" }}>
            <span className="badge badge-2">Coding-agent path</span>
            <h3 style={{ color: "var(--color-fg)", fontWeight: 900, fontSize: "1.55rem", marginTop: "0.9rem", marginBottom: "0.6rem" }}>Use a coding agent</h3>
            <p style={{ color: "var(--color-muted)", lineHeight: 1.65, marginBottom: "1.25rem" }}>
              Give Codex, Claude Code, Cursor, or another coding agent a private prompt that can prepare this project for you.
            </p>
            <p style={{ color: "var(--color-subtle)", fontSize: "0.8rem", lineHeight: 1.55 }}>Copy the prompt, let your agent update the hosted project, then come back here to review before submitting.</p>
            <Link href="#agent-prompt" className="btn-secondary" style={{ marginTop: "1rem", justifyContent: "center" }}>Copy agent prompt</Link>
          </div>
          </div>
        </section>}

        {!finalized && teamSummary && <div style={{ marginBottom: "1.5rem" }}><TeamSummaryCard token={token} summary={teamSummary} /></div>}

        {!finalized && <section className="card" style={{ padding: "1.25rem", marginBottom: "1.5rem" }}>
          <h2 style={{ color: "var(--color-fg)", fontWeight: 850, fontSize: "1.1rem" }}>After your agent finishes</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" style={{ marginTop: "0.9rem" }}>
            <Step number="1" title="Copy the private prompt" />
            <Step number="2" title="Give it to your coding agent" />
            <Step number="3" title="Return here to review and submit" />
          </div>
        </section>}

        {!finalized && <TeamPromptSwitcher
          submissionId={sub.id}
          editToken={token}
          editUrl={links.edit_url}
          previewUrl={links.preview_url}
          finalizeUrl={links.finalize_url}
          baseUrl={getBaseUrl()}
          currentOwner={members[0] ? {
            name: members[0].name,
            email: members[0].email,
            badgeNumber: members[0].badgeNumber,
            affiliation: members[0].affiliation,
            degrees: members[0].degrees,
            isStudentTrainee: members[0].isStudentTrainee,
          } : null}
          currentMembers={members.slice(1).map((member) => ({
            name: member.name,
            email: member.email,
            badgeNumber: member.badgeNumber,
            affiliation: member.affiliation,
            degrees: member.degrees,
            isStudentTrainee: member.isStudentTrainee,
          }))}
        />}
      </main>
    </div>
  );
}

function Step({ number, title }: { number: string; title: string }) {
  return <div className="flex items-start gap-3"><span aria-hidden="true" style={{ width: 28, height: 28, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, borderRadius: "50%", background: "var(--color-surface-2)", border: "1px solid var(--color-border)", color: "var(--color-accent)", fontFamily: "var(--font-mono)", fontSize: "0.75rem" }}>{number}</span><span style={{ color: "var(--color-muted)", fontSize: "0.8rem", lineHeight: 1.45 }}>{title}</span></div>;
}
