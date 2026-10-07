export const dynamic = "force-dynamic";

import Link from "next/link";
import { NavPublic } from "@/components/NavPublic";
import { db } from "@/lib/db";
import { events, submissions, teamMembers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { SaveProjectCard } from "@/components/SaveProjectCard";
import { computePrizeEligibility } from "@/lib/prize-eligibility";
import type { InferSelectModel } from "drizzle-orm";

interface Props {
  params: Promise<{ token: string }>;
}

export default async function SubmissionDonePage({ params }: Props) {
  const { token } = await params;

  const rows = await db.select().from(submissions).where(eq(submissions.editToken, token));
  const sub = rows[0] ?? null;
  const event = sub?.eventId
    ? (await db.select({ judgingDeadline: events.judgingDeadline }).from(events).where(eq(events.id, sub.eventId)).limit(1))[0] ?? null
    : null;
  const members: Array<InferSelectModel<typeof teamMembers>> = sub
    ? await db.select().from(teamMembers).where(eq(teamMembers.submissionId, sub.id)).orderBy(teamMembers.order)
    : [];
  const prizeEligibility = computePrizeEligibility(members.map((member) => ({
    name: member.name,
    badgeNumber: member.badgeNumber,
    isStudentTrainee: member.isStudentTrainee,
  })));

  const NEXT_STEPS = [
    { step: "1", title: "Keep your private link safe", desc: "Use the private project link in Recovery details if you need to make an update before the deadline." },
    { step: "2", title: "Verify your demo", desc: "Make sure your demo URL is live and accessible. Judges and the AI reviewer will test it." },
    { step: "3", title: "Check your repo", desc: "Ensure README.md, AGENTS.md, and .env.example are all present and up to date." },
    { step: "4", title: "Wait for judging", desc: event?.judgingDeadline ? `AI review runs first, then human judges score your project. The event schedule lists judging through ${event.judgingDeadline.toLocaleDateString("en-US", { month: "long", day: "numeric" })}.` : "AI review runs first, then human judges score your project. Watch the event schedule for results." },
  ];

  return (
    <div className="flex flex-col min-h-screen">
      <NavPublic />

      <div className="mx-auto max-w-2xl w-full px-4 sm:px-6 py-16 flex-1">
        {/* Success icon */}
        <div className="text-center mb-10">
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: "color-mix(in srgb, var(--color-success) 15%, transparent)",
              border: "2px solid var(--color-success)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 1.75rem",
              fontSize: "1.75rem",
              color: "var(--color-success)",
            }}
          >
            ✓
          </div>

          <h1
            style={{
              fontFamily: "var(--font-headline)",
              fontSize: "2.25rem",
              fontWeight: 700,
              letterSpacing: "-0.03em",
              color: "var(--color-fg)",
              marginBottom: "0.75rem",
            }}
          >
            Project submitted
          </h1>
          <p style={{ color: "var(--color-muted)", fontSize: "1rem", lineHeight: 1.65 }}>
            {sub ? (
              <>
                <strong style={{ color: "var(--color-fg)" }}>{sub.projectTitle || "Your project"}</strong> from{" "}
                <strong style={{ color: "var(--color-fg)" }}>{sub.teamName}</strong> is ready for judging.
              </>
            ) : (
              "Your submission is now in the queue."
            )}
          </p>
        </div>

        {/* Receipt card */}
        <div className="card mb-8" style={{ padding: "1.25rem" }}>
          <div style={{ fontWeight: 600, color: "var(--color-fg)", marginBottom: "1rem", fontSize: "0.9375rem" }}>
            Submission receipt
          </div>
          <div className="flex flex-col gap-3">
            <ReceiptRow label="Status" value={<span className="badge badge-success">Submitted</span>} />
            {sub && <ReceiptRow label="Project" value={sub.projectTitle ?? ""} />}
            {sub && <ReceiptRow label="Team" value={sub.teamName} />}
            {sub && <ReceiptRow label="Prize eligibility" value={<span className={`badge ${prizeEligibility.eligibleForPrize ? "badge-success" : "badge-warning"}`}>{prizeEligibility.eligibleForPrize ? "Eligible" : "Needs attention"}</span>} />}
            {sub?.submittedAt && <ReceiptRow label="Submitted" value={sub.submittedAt.toLocaleString()} />}
            {event?.judgingDeadline && <ReceiptRow label="Judging through" value={event.judgingDeadline.toLocaleDateString()} />}
          </div>
          {sub && !prizeEligibility.eligibleForPrize && <p style={{ color: "var(--color-warning)", fontSize: "0.8rem", lineHeight: 1.5, marginTop: "0.85rem" }}>The project is submitted, but the team will not be eligible for prizes until every team member has a badge number.</p>}
        </div>

        {/* Next steps */}
        <div className="mb-8">
          <h2 style={{ fontWeight: 600, color: "var(--color-fg)", marginBottom: "1rem", fontSize: "0.9375rem" }}>
            What happens next
          </h2>
          <div className="flex flex-col gap-3">
            {NEXT_STEPS.map((step) => (
              <div key={step.step} className="flex gap-4">
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    border: "1px solid var(--color-border)",
                    background: "var(--color-surface-2)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.75rem",
                    fontFamily: "var(--font-mono)",
                    color: "var(--color-muted)",
                    flexShrink: 0,
                    marginTop: 2,
                  }}
                >
                  {step.step}
                </div>
                <div>
                  <div style={{ fontWeight: 500, color: "var(--color-fg)", fontSize: "0.875rem", marginBottom: "0.25rem" }}>
                    {step.title}
                  </div>
                  <div style={{ fontSize: "0.8125rem", color: "var(--color-muted)", lineHeight: 1.6 }}>
                    {step.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href={`/submit/${token}`} className="btn-secondary" style={{ flex: 1, justifyContent: "center" }}>
            Review submitted project
          </Link>
          <Link href="/account/projects" className="btn-secondary" style={{ flex: 1, justifyContent: "center" }}>
            My Projects
          </Link>
          {sub && (
            <Link href={`/project/${sub.id}`} className="btn-secondary" style={{ flex: 1, justifyContent: "center" }}>
              View public page
            </Link>
          )}
          <Link href="/projects" className="btn-primary" style={{ flex: 1, justifyContent: "center" }}>
            Browse projects →
          </Link>
        </div>

        {sub && <div style={{ marginBottom: "2rem" }}><SaveProjectCard submissionId={sub.id} editToken={token} compact /></div>}

        <details className="card" style={{ padding: "1rem", marginBottom: "2rem" }}>
          <summary style={{ color: "var(--color-fg)", fontWeight: 750, cursor: "pointer" }}>Recovery details</summary>
          <p style={{ color: "var(--color-muted)", fontSize: "0.8rem", lineHeight: 1.55, marginTop: "0.65rem" }}>Keep the private project link safe if you have not saved this project to My Projects. Anyone with it can edit the project.</p>
          <Link href={`/submit/${token}`} style={{ color: "var(--color-accent)", fontFamily: "var(--font-mono)", fontSize: "0.75rem", wordBreak: "break-all" }}>/submit/{token}</Link>
        </details>

        {/* Recovery hint */}
        <div
          className="mt-8 card"
          style={{ padding: "1rem" }}
        >
          <p style={{ fontSize: "0.8125rem", color: "var(--color-muted)", lineHeight: 1.65 }}>
            <strong style={{ color: "var(--color-fg)" }}>Lost your private project link?</strong>{" "}
            If you saved the project to an account, open{" "}
            <Link href="/account/projects" style={{ color: "var(--color-accent)", textDecoration: "none" }}>
              My Projects
            </Link>{" "}
            to find it. Otherwise, use the recovery details from project creation.
          </p>
        </div>
      </div>
    </div>
  );
}

function ReceiptRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 border-b" style={{ borderColor: "var(--color-border)" }}>
      <span style={{ fontSize: "0.8125rem", color: "var(--color-subtle)" }}>{label}</span>
      <span style={{ fontSize: "0.8125rem", color: "var(--color-fg)" }}>{value}</span>
    </div>
  );
}
