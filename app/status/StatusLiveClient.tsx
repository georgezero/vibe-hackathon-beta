"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ParticipationVisualization } from "@/components/status/ParticipationVisualization";
import type { StatusMetrics, InstitutionRow, LeaderboardEntry, StatusBreakdown, EventStage } from "@/lib/event-status";
import type { EventHub } from "@/lib/institution-geo";

// ── Shared types ──────────────────────────────────────────────────────────────

export interface LiveActivity {
  key: string;
  icon: string;
  label: string;
  detail: string | null;
  timestamp: string; // ISO string
}

export interface ClientStatusData {
  stage: EventStage;
  metrics: StatusMetrics;
  institutions: InstitutionRow[];
  maxInstitutionTeams: number;
  audienceLeaderboard: LeaderboardEntry[] | null;
  aiLeaderboard: LeaderboardEntry[];
  officialLeaderboard: LeaderboardEntry[] | null;
  breakdown: StatusBreakdown;
  recentActivity: LiveActivity[];
  votingOpen: boolean;
  resultsVisible: boolean;
  submissionsOpen: boolean;
  winnersPublished: boolean;
  updatedAt: string; // ISO string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function MetricCard({ value, label, accent }: { value: number | string; label: string; accent?: boolean }) {
  return (
    <div className="card" style={{ padding: "1.25rem 1.5rem" }}>
      <div style={{
        fontFamily: "var(--font-headline)",
        fontSize: "clamp(1.75rem, 3.5vw, 2.5rem)",
        fontWeight: 900,
        letterSpacing: "-0.04em",
        color: accent ? "var(--color-accent)" : "var(--color-fg)",
        lineHeight: 1,
      }}>
        {value}
      </div>
      <div style={{ color: "var(--color-muted)", fontSize: "0.8125rem", fontWeight: 500, marginTop: "0.4rem" }}>
        {label}
      </div>
    </div>
  );
}

function InstitutionBar({ name, teams, participants, students, maxTeams }: {
  name: string; teams: number; participants: number; students: number; maxTeams: number;
}) {
  const pct = maxTeams > 0 ? (teams / maxTeams) * 100 : 0;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "0.25rem 0.55rem", alignItems: "center" }}>
      <div>
        <div style={{ fontSize: "0.7rem", fontWeight: 650, color: "var(--color-fg)", marginBottom: "0.16rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {name}
        </div>
        <div style={{ height: 3, background: "var(--color-surface-2)", borderRadius: 999, overflow: "hidden" }}>
          <div style={{ width: `${pct}%`, height: "100%", background: "var(--color-accent)", borderRadius: 999, transition: "width 600ms ease" }} />
        </div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.64rem", fontWeight: 700, color: "var(--color-fg)" }}>
          {teams}t · {participants}p{students > 0 ? ` · ${students}↓` : ""}
        </div>
      </div>
    </div>
  );
}

function LeaderboardCard({ title, subtitle, entries, unit, hiddenMessage, experimental }: {
  title: string;
  subtitle?: string;
  entries: LeaderboardEntry[] | null;
  unit: string;
  hiddenMessage?: string;
  experimental?: boolean;
}) {
  return (
    <div className="card" style={{ padding: "1.25rem" }}>
      <div style={{ marginBottom: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
          <h3 style={{ fontFamily: "var(--font-headline)", fontWeight: 800, fontSize: "1rem", color: "var(--color-fg)", letterSpacing: "-0.02em" }}>
            {title}
          </h3>
          {experimental && <span className="badge badge-default" style={{ fontSize: "0.6rem" }}>Experimental</span>}
        </div>
        {subtitle && <p style={{ color: "var(--color-muted)", fontSize: "0.8125rem", marginTop: "0.2rem" }}>{subtitle}</p>}
      </div>
      {!entries ? (
        <p style={{ color: "var(--color-muted)", fontSize: "0.875rem", lineHeight: 1.65 }}>
          {hiddenMessage ?? "Results will appear here once available."}
        </p>
      ) : entries.length === 0 ? (
        <p style={{ color: "var(--color-muted)", fontSize: "0.875rem" }}>No data yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {entries.map((entry, i) => (
            <div key={entry.submissionId} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.5rem 0", borderBottom: i < entries.length - 1 ? "1px solid var(--color-border)" : "none" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: "0.875rem", color: i === 0 ? "var(--color-warning)" : "var(--color-subtle)", minWidth: "1.75rem", textAlign: "center", flexShrink: 0 }}>
                {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                {entry.linkable ? (
                  <Link href={`/project/${entry.submissionId}`} style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--color-fg)", textDecoration: "none", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {entry.projectTitle ?? entry.teamName}
                  </Link>
                ) : (
                  <span style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--color-fg)", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {entry.projectTitle ?? entry.teamName}
                  </span>
                )}
                <span style={{ fontSize: "0.75rem", color: "var(--color-muted)" }}>{entry.teamName}</span>
              </div>
              <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: "0.9375rem", color: i === 0 ? "var(--color-accent)" : "var(--color-fg)", flexShrink: 0 }}>
                {entry.score} <span style={{ fontSize: "0.6875rem", color: "var(--color-muted)", fontWeight: 500 }}>{unit}</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BreakdownChip({ label, value, colorVar }: { label: string; value: number; colorVar?: string }) {
  return (
    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", background: "var(--color-surface-2)", borderRadius: 10, padding: "0.75rem 1.25rem", minWidth: "4.5rem", gap: "0.25rem" }}>
      <span style={{ fontFamily: "var(--font-headline)", fontWeight: 900, fontSize: "1.5rem", color: colorVar ?? "var(--color-fg)", letterSpacing: "-0.03em", lineHeight: 1 }}>{value}</span>
      <span style={{ fontSize: "0.6875rem", color: "var(--color-muted)", fontWeight: 500, whiteSpace: "nowrap", textAlign: "center" }}>{label}</span>
    </div>
  );
}

function ActivityFeed({ items }: { items: LiveActivity[] }) {
  if (items.length === 0) return (
    <p style={{ color: "var(--color-muted)", fontSize: "0.875rem", padding: "0.5rem 0" }}>Activity will appear as the event gets underway.</p>
  );
  return (
    <div className="flex flex-col">
      {items.map((item, i) => (
        <div key={item.key} style={{ display: "grid", gridTemplateColumns: "2rem 1fr auto", alignItems: "start", gap: "0.5rem", padding: "0.625rem 0", borderBottom: i < items.length - 1 ? "1px solid var(--color-border)" : "none" }}>
          <span style={{ fontSize: "1rem", lineHeight: 1.5, textAlign: "center" }}>{item.icon}</span>
          <div>
            <span style={{ fontWeight: 600, fontSize: "0.8125rem", color: "var(--color-fg)" }}>{item.label}</span>
            {item.detail && <span style={{ color: "var(--color-muted)", fontSize: "0.8125rem" }}> — {item.detail}</span>}
          </div>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.6875rem", color: "var(--color-subtle)", whiteSpace: "nowrap", paddingTop: "0.125rem" }}>
            {timeAgo(item.timestamp)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Live indicator ────────────────────────────────────────────────────────────

function LiveIndicator({ status, updatedAt }: { status: "live" | "updating" | "error"; updatedAt: string }) {
  const dot = status === "error" ? "var(--color-error)" : status === "updating" ? "var(--color-warning)" : "var(--color-success)";
  const label = status === "error" ? "Update failed" : status === "updating" ? "Refreshing…" : `Live · Updated ${formatTime(updatedAt)}`;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: dot, display: "inline-block", flexShrink: 0 }} />
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.6875rem", color: "var(--color-subtle)" }}>{label}</span>
    </div>
  );
}

// ── Main client component ─────────────────────────────────────────────────────

interface Props {
  initialData: ClientStatusData;
  hub: EventHub;
}

export function StatusLiveClient({ initialData, hub }: Props) {
  const [data, setData] = useState(initialData);
  const [liveStatus, setLiveStatus] = useState<"live" | "updating" | "error">("live");

  const poll = useCallback(async () => {
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
    try {
      setLiveStatus("updating");
      const res = await fetch("/api/v1/status/live");
      if (!res.ok) throw new Error("non-ok");
      const json = await res.json();
      setData({ ...json, updatedAt: json.generatedAt });
      setLiveStatus("live");
    } catch {
      setLiveStatus("error");
    }
  }, []);

  useEffect(() => {
    const id = setInterval(poll, 20000);
    return () => clearInterval(id);
  }, [poll]);

  const hasLeaderboards = data.audienceLeaderboard !== null || data.aiLeaderboard.length > 0 || data.officialLeaderboard !== null;
  return (
    <div>
      {/* Metrics header */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "1rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        <h2 style={{ fontFamily: "var(--font-headline)", fontWeight: 800, fontSize: "1.1rem", color: "var(--color-fg)", letterSpacing: "-0.02em" }}>
          Event at a Glance
        </h2>
        <LiveIndicator status={liveStatus} updatedAt={data.updatedAt} />
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" style={{ marginBottom: "2.5rem" }}>
        <MetricCard value={data.metrics.totalRegistrations} label="Teams Registered" />
        <MetricCard value={data.metrics.projectsFinalized} label="Projects Finalized" accent />
        <MetricCard value={data.metrics.prizeEligibleTeams} label="Prize Eligible Teams" />
        <MetricCard value={data.metrics.studentParticipants} label="Student/Trainee Participants" />
        <MetricCard value={data.metrics.institutionsCount} label="Institutions Represented" />
        <MetricCard value={data.metrics.audienceVotesTotal} label="Audience Votes" accent />
        <MetricCard value={data.metrics.aiEvalsCompleted} label="AI Evaluations Completed" />
        <MetricCard value={data.metrics.judgeScorecardsCompleted} label="Judge Scorecards Completed" />
      </div>

      {/* Institutions: bars + map */}
      <section style={{ marginBottom: "2.5rem" }}>
        <div style={{ marginBottom: "1rem" }}>
          <div>
            <h2 style={{ fontFamily: "var(--font-headline)", fontWeight: 850, fontSize: "1.15rem", color: "var(--color-fg)", letterSpacing: "-0.025em", marginBottom: "0.25rem" }}>
              Global Participation
            </h2>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,27%)_minmax(0,73%)] gap-3">
          {/* Bars */}
          <div className="card" style={{ padding: "0.7rem" }}>
            {data.institutions.length === 0 ? (
              <p style={{ color: "var(--color-muted)", fontSize: "0.875rem", textAlign: "center", padding: "1rem 0" }}>
                Institutions will appear as teams complete registration.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {data.institutions.map((inst) => (
                  <InstitutionBar key={inst.name} name={inst.name} teams={inst.teams} participants={inst.participants} students={inst.students} maxTeams={data.maxInstitutionTeams} />
                ))}
              </div>
            )}
          </div>
          {/* Map — edge-to-edge, no padding */}
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <ParticipationVisualization institutions={data.institutions} hub={hub} />
          </div>
        </div>
      </section>

      {/* Leaderboards */}
      {hasLeaderboards && (
        <section style={{ marginBottom: "2.5rem" }}>
          <h2 style={{ fontFamily: "var(--font-headline)", fontWeight: 800, fontSize: "1.1rem", color: "var(--color-fg)", letterSpacing: "-0.02em", marginBottom: "1rem" }}>
            Results
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <LeaderboardCard title="Audience Votes" subtitle={data.votingOpen ? "Voting is open" : undefined} entries={data.audienceLeaderboard} unit="votes" hiddenMessage="Audience voting is active. Results will be revealed later." />
            <LeaderboardCard title="AI Evaluations" subtitle="Organizer-run deterministic review" entries={data.aiLeaderboard.length > 0 ? data.aiLeaderboard : null} unit="pts" hiddenMessage="AI evaluations will appear as reviews are completed." experimental />
            <LeaderboardCard title="Official Results" entries={data.officialLeaderboard} unit="pts" hiddenMessage="Official results will appear after winners are announced." />
          </div>
        </section>
      )}

      {/* Breakdown + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" style={{ marginBottom: "2.5rem" }}>
        <section>
          <h2 style={{ fontFamily: "var(--font-headline)", fontWeight: 800, fontSize: "1.1rem", color: "var(--color-fg)", letterSpacing: "-0.02em", marginBottom: "1rem" }}>
            Participation Breakdown
          </h2>
          <div className="card" style={{ padding: "1.25rem" }}>
            <div style={{ marginBottom: "1rem" }}>
              <p style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--color-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.625rem" }}>Submission Status</p>
              <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                <BreakdownChip label="Draft" value={data.breakdown.draft} />
                <BreakdownChip label="Submitted" value={data.breakdown.submitted} />
                <BreakdownChip label="Finalized" value={data.breakdown.finalized} colorVar="var(--color-success)" />
              </div>
            </div>
            <div style={{ marginBottom: "1rem" }}>
              <p style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--color-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.625rem" }}>Prize Eligibility</p>
              <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                <BreakdownChip label="Eligible" value={data.breakdown.prizeEligible} colorVar="var(--color-success)" />
                <BreakdownChip label="Incomplete" value={data.breakdown.prizeIncomplete} colorVar="var(--color-warning)" />
              </div>
            </div>
            <div>
              <p style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--color-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.625rem" }}>Participant Type</p>
              <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                <BreakdownChip label="Student/Trainee" value={data.breakdown.students} colorVar="var(--color-accent-2)" />
                <BreakdownChip label="Other" value={data.breakdown.others} />
              </div>
            </div>
          </div>
        </section>

        <section>
          <h2 style={{ fontFamily: "var(--font-headline)", fontWeight: 800, fontSize: "1.1rem", color: "var(--color-fg)", letterSpacing: "-0.02em", marginBottom: "1rem" }}>
            Recent Activity
          </h2>
          <div className="card" style={{ padding: "1rem 1.25rem" }}>
            <ActivityFeed items={data.recentActivity} />
          </div>
        </section>
      </div>

      {/* CTAs */}
      <section>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "center" }}>
          {data.submissionsOpen && (
            <>
              <Link href="/register-team" className="btn-primary">Register Team →</Link>
              <Link href="/submit" className="btn-secondary">Complete Submission</Link>
            </>
          )}
          {data.votingOpen && <Link href="/projects" className="btn-primary">Vote on Projects →</Link>}
          {data.winnersPublished && <Link href="/winners" className="btn-primary">View Winners →</Link>}
          <Link href="/projects" className="btn-secondary">Browse Projects</Link>
          {data.metrics.aiEvalsCompleted > 0 && <Link href="/ai-evals" className="btn-secondary">AI Evaluations</Link>}
        </div>
      </section>
    </div>
  );
}
