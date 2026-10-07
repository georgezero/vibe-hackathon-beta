export const dynamic = "force-dynamic";

import Link from "next/link";
import { NavPublic } from "@/components/NavPublic";
import { getEventBranding } from "@/lib/event-branding";
import { getActiveEvent, audienceVotingStatus, submissionDeadlineStatus } from "@/lib/events";
import { getPublicationData } from "@/lib/publication";
import { db } from "@/lib/db";
import { submissions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export default async function LandingPage() {
  const [branding, activeEvent] = await Promise.all([getEventBranding(), getActiveEvent()]);
  const [publication, eventProjects] = await Promise.all([
    getPublicationData(activeEvent.id),
    db.select({ status: submissions.status }).from(submissions).where(eq(submissions.eventId, activeEvent.id)),
  ]);
  const voting = audienceVotingStatus(activeEvent);
  const deadline = submissionDeadlineStatus(activeEvent);
  const resultsPublished = publication.release.status === "published" || publication.release.status === "archived";
  const projectCount = eventProjects.length;
  const finalizedCount = eventProjects.filter((project: { status: string }) => project.status === "finalized" || project.status === "locked" || project.status === "submitted").length;
  const eventOrientation = activeEvent.isFrozen || !deadline.open
    ? { label: "Submissions are closed", detail: "Explore projects while judging is underway.", action: { href: "/projects", label: "Explore projects" } }
    : resultsPublished
      ? { label: "Results are available", detail: "Explore the winning projects and event history.", action: { href: "/winners", label: "View results" } }
      : { label: "Submissions are open", detail: "Build a project, form a team, and submit when you are ready.", action: { href: "/start", label: "Start a project" } };
  const votingStatus = voting.votingMode !== "disabled"
    ? (voting.open ? "open" : "closed") as "open" | "closed"
    : null;

  const JUDGING_CRITERIA = [
    { label: "Problem Selection", desc: "Is this the right problem to solve?" },
    { label: "Product Usefulness", desc: "Would real users pay for this?" },
    { label: "Functionality", desc: "Does it reliably do what it claims?" },
    { label: "UX & Design", desc: "Is the experience polished and clear?" },
    { label: "AI Collaboration", desc: "How well did the team wield AI agents?" },
    { label: "Originality", desc: "Is the approach novel and interesting?" },
    { label: "Maintainability", desc: "Is the codebase clean and documented?" },
    { label: "Presentation", desc: "Is the submission clear and well-communicated?" },
  ];

  const MARQUEE_ITEMS = [
    "Claude", "Cursor", "Codex", "Hermes", "OpenClaw", "Pi",
    "GitHub Copilot", "Aider", "Devin", "SWE-agent",
    "Claude", "Cursor", "Codex", "Hermes", "OpenClaw", "Pi",
    "GitHub Copilot", "Aider", "Devin", "SWE-agent",
  ];

  return (
    <div className="flex flex-col min-h-screen">
      <NavPublic />

      {/* Hero */}
      <section className="relative overflow-hidden" style={{ minHeight: "88vh", display: "flex", alignItems: "center" }}>
        <div className="hero-grid absolute inset-0 pointer-events-none" />
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 pointer-events-none"
          style={{
            width: 700,
            height: 500,
            background: "radial-gradient(ellipse at center, color-mix(in srgb, var(--color-accent) 10%, transparent) 0%, transparent 70%)",
          }}
        />
        <div className="relative mx-auto max-w-5xl px-4 sm:px-6 py-24 text-center">
          {branding.logoUrl && (
            <div className="animate-fade-up mb-8 flex justify-center">
              <img
                src={branding.logoUrl}
                alt={branding.eventName}
                style={{ height: 72, maxWidth: 220, objectFit: "contain", display: "block" }}
              />
            </div>
          )}
          <div className="animate-fade-up mb-8 flex justify-center">
            <span className="badge badge-accent inline-flex items-center gap-1.5" style={{ fontSize: "0.75rem" }}>
              <span
                className="animate-pulse-dot inline-block rounded-full"
                style={{ width: 6, height: 6, background: "var(--color-accent)" }}
              />
              {eventOrientation.label}
            </span>
          </div>

          <h1
            className="animate-fade-up delay-75"
            style={{
              fontFamily: "var(--font-headline)",
              fontSize: "clamp(2.25rem, 10vw, 7rem)",
              fontWeight: 800,
              lineHeight: 0.95,
              letterSpacing: "-0.04em",
              color: "var(--color-fg)",
              marginBottom: "1.5rem",
            }}
          >
            Vibe<span style={{ color: "var(--color-accent)" }}>.</span>
            <br />
            Hackathon
          </h1>

          <p
            className="animate-fade-up delay-150"
            style={{
              fontSize: "clamp(1rem, 2.5vw, 1.25rem)",
              color: "var(--color-muted)",
              maxWidth: 520,
              margin: "0 auto 2.5rem",
              lineHeight: 1.65,
            }}
          >
            {branding.tagline}
          </p>

          <div className="animate-fade-up delay-225 flex items-center justify-center gap-3 flex-wrap">
            <Link href={eventOrientation.action.href} className="btn-primary" style={{ fontSize: "1rem", padding: "0.75rem 1.75rem" }}>
              {eventOrientation.action.label}
            </Link>
            <Link href="/projects" className="btn-secondary" style={{ fontSize: "1rem", padding: "0.75rem 1.75rem", display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
              View Projects
              {votingStatus && (
                <span style={{
                  fontSize: "0.5625rem",
                  fontWeight: 700,
                  padding: "0.2rem 0.45rem",
                  borderRadius: 999,
                  background: votingStatus === "open"
                    ? "color-mix(in srgb, var(--color-success) 22%, transparent)"
                    : "var(--color-surface-2)",
                  color: votingStatus === "open" ? "var(--color-success)" : "var(--color-subtle)",
                  letterSpacing: "0.05em",
                  textTransform: "uppercase" as const,
                  lineHeight: 1,
                  whiteSpace: "nowrap" as const,
                }}>
                  {votingStatus === "open" ? "Voting Open" : "Voting Closed"}
                </span>
              )}
            </Link>
          </div>

          <section className="animate-fade-up delay-300 event-orientation" aria-label="What you can do now">
            <div className="event-orientation-copy"><strong>{eventOrientation.label}</strong><p>{eventOrientation.detail}</p></div>
            <Link className="btn-secondary" href={eventOrientation.action.href}>{eventOrientation.action.label}</Link>
          </section>

          <div className="animate-fade-up delay-300 mt-10 grid grid-cols-2 gap-6 max-w-xs mx-auto">
            {[
              { value: projectCount, label: "Projects started" },
              { value: finalizedCount, label: "Projects submitted" },
            ].map(({ value, label }) => (
              <div key={label} className="text-center">
                <div style={{ fontFamily: "var(--font-headline)", fontSize: "2rem", fontWeight: 700, color: "var(--color-fg)", lineHeight: 1 }}>
                  {value}
                </div>
                <div style={{ fontSize: "0.6875rem", color: "var(--color-subtle)", marginTop: "0.375rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  {label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Marquee */}
      <div className="overflow-hidden py-3.5 border-y" style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
        <div className="animate-marquee flex gap-0 whitespace-nowrap" style={{ width: "max-content" }}>
          {MARQUEE_ITEMS.map((item, i) => (
            <span key={i} style={{ fontSize: "0.75rem", fontFamily: "var(--font-mono)", color: "var(--color-subtle)", padding: "0 2rem" }}>
              {item}
            </span>
          ))}
        </div>
      </div>

      {/* Judging criteria */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 py-20">
        <div className="mb-12">
          <span className="badge badge-default mb-4">Judging criteria</span>
          <h2
            style={{
              fontFamily: "var(--font-headline)",
              fontSize: "clamp(1.75rem, 4vw, 2.75rem)",
              fontWeight: 700,
              letterSpacing: "-0.03em",
              color: "var(--color-fg)",
            }}
          >
            We judge on strategy,{" "}
            <span style={{ color: "var(--color-muted)" }}>not just output.</span>
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {JUDGING_CRITERIA.map((c, i) => (
            <div key={c.label} className="card" style={{ padding: "1.25rem" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.625rem", color: "var(--color-subtle)", marginBottom: "0.75rem", letterSpacing: "0.08em" }}>
                {String(i + 1).padStart(2, "0")}
              </div>
              <div style={{ fontWeight: 600, color: "var(--color-fg)", marginBottom: "0.375rem", fontSize: "0.9375rem" }}>{c.label}</div>
              <div style={{ fontSize: "0.8125rem", color: "var(--color-muted)", lineHeight: 1.5 }}>{c.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="border-y" style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-20">
          <div className="mb-12">
            <span className="badge badge-default mb-4">How it works</span>
            <h2 style={{ fontFamily: "var(--font-headline)", fontSize: "clamp(1.75rem, 4vw, 2.75rem)", fontWeight: 700, letterSpacing: "-0.03em", color: "var(--color-fg)" }}>
              Build. Submit. Get judged.
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                title: "Create a draft",
                desc: "Start a project and get a private project link. Come back any time to update your details before the deadline.",
              },
              {
                step: "02",
                title: "Build & document",
                desc: "Ship a working demo. Include AGENTS.md, a seed script, and full docs so an AI agent can run your project cold.",
              },
              {
                step: "03",
                title: "Submit & get judged",
                desc: "Submit before the deadline. AI reviews your repo first, then human judges score on 8 dimensions.",
              },
            ].map((step) => (
              <div key={step.step} className="flex gap-4">
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "1.75rem", fontWeight: 700, color: "var(--color-accent)", lineHeight: 1, minWidth: "3rem" }}>
                  {step.step}
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: "var(--color-fg)", marginBottom: "0.5rem", fontSize: "1rem" }}>{step.title}</div>
                  <div style={{ fontSize: "0.875rem", color: "var(--color-muted)", lineHeight: 1.65 }}>{step.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Repo requirements */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 py-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          <div>
            <span className="badge badge-default mb-4">Repo requirements</span>
            <h2 style={{ fontFamily: "var(--font-headline)", fontSize: "clamp(1.75rem, 4vw, 2.75rem)", fontWeight: 700, letterSpacing: "-0.03em", color: "var(--color-fg)", marginBottom: "1rem" }}>
              An AI agent should be able to run your project cold.
            </h2>
            <p style={{ color: "var(--color-muted)", lineHeight: 1.7, maxWidth: 440, fontSize: "0.9375rem" }}>
              Your AGENTS.md is your AI co-pilot manual. It should explain how a coding agent can understand, run, seed, test, and deploy your project from scratch.
            </p>
          </div>
          <div className="card" style={{ padding: "1.25rem" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.8125rem", lineHeight: 1 }}>
              {[
                { file: "vibe.json", req: true },
                { file: "README.md", req: true },
                { file: "AGENTS.md", req: true },
                { file: "LICENSE", req: true },
                { file: ".env.example", req: true },
                { file: "docs/vibe-submission.md", req: false },
                { file: "docs/agent-report.md", req: false },
                { file: "docs/prompts.md", req: false },
                { file: "docker-compose.yml", req: false },
              ].map(({ file, req }, i) => (
                <div
                  key={file}
                  className="flex items-center justify-between py-2.5"
                  style={{ borderBottom: i < 8 ? "1px solid var(--color-border)" : "none" }}
                >
                  <span style={{ color: "var(--color-fg)" }}>{file}</span>
                  <span className={`badge ${req ? "badge-accent" : "badge-default"}`}>
                    {req ? "required" : "recommended"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Agent submission */}
      <section className="border-t" style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
            <div>
              <span className="badge badge-accent mb-4">Agent-native</span>
              <h2 style={{ fontFamily: "var(--font-headline)", fontSize: "clamp(1.75rem, 4vw, 2.75rem)", fontWeight: 700, letterSpacing: "-0.03em", color: "var(--color-fg)", marginBottom: "1rem" }}>
                Submit from your agent.
              </h2>
              <p style={{ color: "var(--color-muted)", lineHeight: 1.7, maxWidth: 440, fontSize: "0.9375rem", marginBottom: "1.5rem" }}>
                Your agent can submit, update, and finalize your project entirely via API or MCP tools — no browser required. Teams can also use the web form. All paths are supported.
              </p>
              <div className="flex gap-3 flex-wrap">
                <Link href="/submit/instructions" className="btn-secondary" style={{ fontSize: "0.875rem" }}>
                  Submission guide →
                </Link>
                <a href="/api/v1/spec" target="_blank" rel="noopener noreferrer" className="btn-ghost" style={{ fontSize: "0.875rem" }}>
                  Machine-readable spec ↗
                </a>
              </div>
            </div>
            <div className="card" style={{ padding: "1.25rem", overflow: "auto" }}>
              <div className="flex items-center justify-between mb-3">
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.6875rem", color: "var(--color-subtle)", letterSpacing: "0.04em" }}>AGENT SUBMISSION — 3 STEPS</span>
              </div>
              <pre style={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem", color: "var(--color-muted)", margin: 0, lineHeight: 1.75, whiteSpace: "pre-wrap" }}>{`# 1. Create submission from vibe.json
curl -X POST /api/v1/submissions/from-repo \\
  -d '{"vibe_json": $(cat vibe.json)}'
# → { id, editToken, validationResult }

# 2. Store token safely (never commit it)
export VIBE_EDIT_TOKEN=edit_xxxxxxxxxxxxxxxx
export VIBE_SUBMISSION_ID=sub_xxxxxxxx

# 3. Finalize before the deadline
curl -X POST /api/v1/submissions/$VIBE_SUBMISSION_ID/finalize \\
  -H "Authorization: Bearer $VIBE_EDIT_TOKEN"
# → triggers AI repo review`}</pre>
              <div className="flex gap-2 mt-4 flex-wrap">
                {[
                  { label: "vibe.list_requirements", color: "var(--color-subtle)" },
                  { label: "vibe.validate_repo", color: "var(--color-subtle)" },
                  { label: "vibe.create_submission", color: "var(--color-accent)" },
                  { label: "vibe.finalize_submission", color: "var(--color-accent)" },
                ].map(({ label, color }) => (
                  <span key={label} style={{ fontFamily: "var(--font-mono)", fontSize: "0.6rem", color, border: "1px solid var(--color-border)", borderRadius: 4, padding: "0.15rem 0.4rem" }}>
                    {label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t" style={{ borderColor: "var(--color-border)" }}>
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-24 text-center">
          <h2
            style={{
              fontFamily: "var(--font-headline)",
              fontSize: "clamp(2rem, 5vw, 3.5rem)",
              fontWeight: 800,
              letterSpacing: "-0.04em",
              color: "var(--color-fg)",
              marginBottom: "1rem",
            }}
          >
            Ready to ship?
          </h2>
          <p style={{ color: "var(--color-muted)", marginBottom: "2rem", fontSize: "1.0625rem" }}>
            Prize pool: $10,000
          </p>
          <Link href="/start" className="btn-primary" style={{ fontSize: "1rem", padding: "0.875rem 2.25rem" }}>
            Start your project →
          </Link>
        </div>
      </section>

    </div>
  );
}
