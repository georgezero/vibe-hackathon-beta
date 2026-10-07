"use client";

import { useCallback, useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ShortcutHelpOverlay } from "@/components/ShortcutHelpOverlay";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { adminSessionCaption } from "@/lib/admin-identity-display";
import { EventHealthPanel } from "@/components/EventHealthPanel";
import type { EventHealthData } from "@/lib/event-health";

export interface SubmissionRow {
  id: string;
  editToken: string;
  status: string;
  teamName: string;
  contactEmail: string;
  projectTitle: string | null;
  demoUrl: string | null;
  voteCount: number;
  aiReviewStatus: string | null;
  aiGeneratedScore: number | null;
  aiComplianceCheck: string | null;
  aiGeneratedRationale: string | null;
  avgHumanScore: number | null;
  ownerGithubLogin: string | null;
  ownershipType: "github" | "badge";
  teamSize: number;
  badgeCount: number;
  prizeEligible: boolean;
  studentTraineeCount: number;
  ownerBadgePresent: boolean;
  badgeVerificationStatus: string;
}

export interface JudgeRow {
  id: string;
  name: string;
  email: string;
  assignedCount: number;
  completedCount: number;
}

export interface HumanScoreSummary {
  id: string;
  submissionId: string;
  judgeId: string;
  judgeName: string;
  score: number | null;
  completed: boolean;
  recommendation: string | null;
}

export interface RankingRow {
  submissionId: string;
  projectTitle: string | null;
  teamName: string;
  status: string;
  rank: number | null;
  officialScore: number | null;
  humanAverageScore: number | null;
  aiReproducibilityScore: number | null;
  aiOverallScore: number | null;
  audienceVotes: number;
  audienceScore: number;
  judgeCompletionCount: number;
  totalAssignedJudges: number;
  rankStatus: "incomplete" | "provisional" | "final";
  warnings: string[];
  humanScores: HumanScoreSummary[];
  scoringFormula: string;
}

export interface JudgeCalibrationRow {
  judgeId: string;
  judgeName: string;
  judgeEmail: string;
  reviewsAssigned: number;
  reviewsCompleted: number;
  averageScoreGiven: number | null;
  standardDeviation: number | null;
  averageDeviationFromPanelMean: number | null;
  outlierCount: number;
}

export interface PeoplesChoiceRow {
  submissionId: string;
  projectTitle: string | null;
  teamName: string;
  rank: number;
  audienceVotes: number;
}

export interface ActiveEventRow {
  id: string;
  name: string;
  displayName: string | null;
  logoUrl: string | null;
  tagline: string | null;
  externalUrl: string | null;
  slug: string;
  isActive: boolean;
  audienceVotingEnabled: boolean;
  audienceAwardCount: number;
  audienceVotesPerPerson: number;
  audienceVotingStartsAt: string | null;
  audienceVotingEndsAt: string | null;
  audienceResultsVisible: boolean;
  audienceVotingMode: string;
  audienceIdentityMethod: string;
  submissionDeadline: string | null;
  judgingDeadline: string | null;
  winnersPublishedAt: string | null;
  isFrozen: boolean;
  showJudgeChoice: boolean;
  showPeoplesChoice: boolean;
  showAIChoice: boolean;
  showSpecialAwards: boolean;
}

export interface AllEventRow {
  id: string;
  name: string;
  displayName: string | null;
  isActive: boolean;
  winnersPublishedAt: string | null;
  showJudgeChoice: boolean;
  showPeoplesChoice: boolean;
  showAIChoice: boolean;
  showSpecialAwards: boolean;
}

export interface DeadlineStatus {
  open: boolean;
  label: string;
  daysRemaining: number | null;
}

export interface HarnessCount { name: string; count: number; pct: number }
export interface ModelCount { name: string; count: number; pct: number }
export interface BudgetCount { tier: string; label: string; count: number; pct: number }

export interface AnalyticsData {
  harnesses: HarnessCount[];
  models: ModelCount[];
  budgetTiers: BudgetCount[];
  avgHumanHours: number | null;
  avgAgentHours: number | null;
  totalHumanHours: number;
  totalAgentHours: number;
  submissionsWithVibeJson: number;
  submissionsWithBudgetData: number;
  totalSubmissions: number;
}

export interface AiJudgeRunRow {
  id: string;
  submissionId: string;
  modelProvider: string;
  modelName: string;
  status: "pending" | "running" | "complete" | "failed";
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
  rationale: string | null;
  scoresJson: Record<string, unknown> | null;
  createdAt: string | null;
}

export interface SubmissionReadinessRow {
  id: string;
  editToken: string;
  projectTitle: string | null;
  teamName: string;
  contactEmail: string;
  status: string;
  completeCount: number;
  totalCount: number;
  completionPercent: number;
  readinessStatus: "ready" | "incomplete" | "finalized";
  teamEligible: boolean;
  badgeCount: number;
  memberCount: number;
  studentTraineeCount: number;
  missingItems: Array<{ key: string; label: string }>;
  updatedAt: string | null;
}

export interface AdminTeamMemberRow {
  name: string;
  role: "Team Lead" | "Teammate";
  email: string | null;
  badgeNumber: string | null;
  degrees: string | null;
  affiliation: string | null;
  isStudentTrainee: boolean;
  badgeVerificationStatus: string;
}

export interface AdminTeamRosterRow {
  submissionId: string;
  teamName: string;
  projectTitle: string | null;
  ownershipType: "github" | "badge";
  ownerGithubLogin: string | null;
  teamSize: number;
  badgeCount: number;
  prizeEligible: boolean;
  studentTraineeCount: number;
  members: AdminTeamMemberRow[];
}

export interface PresentationEligibilityRow {
  submissionId: string;
  projectTitle: string | null;
  teamName: string;
  status: string;
  eligible: boolean;
  isInProgress: boolean;
  memberCount: number;
  geocodedInstitutionCount: number;
  institutions: string[];
  contentSignalCount: number;
  contentSignals: string[];
  missingReasons: string[];
}

export interface AdminIdentitySession {
  authentication_mechanism: "better-auth" | "viby";
  local_user_id: string | null;
  viby_user_id: string | null;
  display_name: string;
  role: "admin";
  issued_at: number;
  expires_at: number;
  identity_method: string | null;
  identity_confidence: number | null;
}

export interface AdminPageData {
  submissions: SubmissionRow[];
  judges: JudgeRow[];
  totalVotes: number;
  finalizedCount: number;
  completedScoresCount: number;
  completedAiReviews: number;
  analytics: AnalyticsData;
  rankings: RankingRow[];
  peoplesChoiceRankings: PeoplesChoiceRow[];
  judgeCalibration: JudgeCalibrationRow[];
  activeEvent: ActiveEventRow | null;
  allEvents: AllEventRow[];
  submissionDeadlineStatus: DeadlineStatus;
  judgingDeadlineStatus: DeadlineStatus;
  aiJudgeRuns: AiJudgeRunRow[];
  submissionReadiness: SubmissionReadinessRow[];
  teamRosters: AdminTeamRosterRow[];
  baseUrl: string;
  baseUrlConfigured: boolean;
  audienceVoterCount: number;
  audienceEmailCaptureCount: number;
  presentationEligibility: PresentationEligibilityRow[];
  eventHealth: EventHealthData | null;
  initialTab: string;
  adminSession: AdminIdentitySession;
}

type Tab = "overview" | "submissions" | "readiness" | "rankings" | "judges" | "ai" | "votes" | "analytics" | "export" | "checklist" | "winners" | "event-settings" | "release" | "presentation";

const TAB_TO_URL: Record<Tab, string> = {
  overview: "overview",
  submissions: "submissions",
  readiness: "submission-readiness",
  rankings: "rankings",
  judges: "judges",
  ai: "ai-reviews",
  votes: "audience-votes",
  analytics: "analytics",
  export: "export",
  checklist: "demo-checklist",
  winners: "winners",
  "event-settings": "event-settings",
  release: "release-checklist",
  presentation: "presentation",
};

const VALID_TABS = new Set<Tab>(["overview", "submissions", "readiness", "rankings", "judges", "ai", "votes", "analytics", "export", "checklist", "winners", "event-settings", "release", "presentation"]);

const ADMIN_SHORTCUT_TABS: Tab[] = [
  "overview",
  "submissions",
  "readiness",
  "rankings",
  "judges",
  "ai",
  "votes",
  "analytics",
  "export",
  "checklist",
  "release",
  "presentation",
  "event-settings",
  "winners",
];

const ADMIN_NUMERIC_TABS: Record<string, Tab> = {
  "1": "overview",
  "2": "submissions",
  "3": "rankings",
  "4": "judges",
  "5": "ai",
  "6": "votes",
  "7": "analytics",
  "8": "export",
  "9": "event-settings",
  "0": "checklist",
};

function toTab(s: string): Tab {
  return VALID_TABS.has(s as Tab) ? (s as Tab) : "overview";
}

export default function AdminDashboardClient({ data }: { data: AdminPageData }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(toTab(data.initialTab));
  const [showHelp, setShowHelp] = useState(false);
  const [selectedTeamRoster, setSelectedTeamRoster] = useState<AdminTeamRosterRow | null>(null);
  const tabListRef = useRef<HTMLDivElement | null>(null);
  const tabButtonRefs = useRef<Partial<Record<Tab, HTMLButtonElement>>>({});

  useEffect(() => {
    setTab(toTab(data.initialTab));
  }, [data.initialTab]);

  useEffect(() => {
    const tabList = tabListRef.current;
    const tabButton = tabButtonRefs.current[tab];
    if (!tabList || !tabButton) return;

    const listRect = tabList.getBoundingClientRect();
    const buttonRect = tabButton.getBoundingClientRect();
    const padding = 12;

    if (buttonRect.left < listRect.left + padding || buttonRect.right > listRect.right - padding) {
      tabButton.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
    }
  }, [tab]);

  useEffect(() => {
    const handlePop = () => {
      const slug = window.location.pathname.replace(/^\/admin\/dashboard\/?/, "") || "overview";
      const mapped: Record<string, Tab> = {
        "overview": "overview", "submissions": "submissions", "submission-readiness": "readiness", "rankings": "rankings",
        "judges": "judges", "ai-reviews": "ai", "audience-votes": "votes",
        "analytics": "analytics", "export": "export", "demo-checklist": "checklist", "release-checklist": "release", "presentation": "presentation", "winners": "winners", "event-settings": "event-settings",
      };
      setTab(mapped[slug] ?? "overview");
    };
    window.addEventListener("popstate", handlePop);
    return () => window.removeEventListener("popstate", handlePop);
  }, []);

  function handleTabChange(newTab: Tab) {
    setTab(newTab);
    router.push(`/admin/dashboard/${TAB_TO_URL[newTab]}`, { scroll: false });
  }

  const navigateShortcutTab = useCallback((newTab: Tab) => {
    setTab(newTab);
    router.push(`/admin/dashboard/${TAB_TO_URL[newTab]}`, { scroll: false });
  }, [router]);

  const moveShortcutTab = useCallback((direction: 1 | -1) => {
    const currentIndex = ADMIN_SHORTCUT_TABS.includes(tab)
      ? ADMIN_SHORTCUT_TABS.indexOf(tab)
      : 0;
    const nextIndex = (currentIndex + direction + ADMIN_SHORTCUT_TABS.length) % ADMIN_SHORTCUT_TABS.length;
    navigateShortcutTab(ADMIN_SHORTCUT_TABS[nextIndex]);
  }, [navigateShortcutTab, tab]);

  useKeyboardShortcuts(useCallback((event) => {
    if (event.key === "?") {
      event.preventDefault();
      setShowHelp((value) => !value);
      return;
    }
    if (event.key === "Escape") {
      setShowHelp(false);
      return;
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      moveShortcutTab(-1);
      return;
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      moveShortcutTab(1);
      return;
    }

    const numericTab = ADMIN_NUMERIC_TABS[event.key];
    if (numericTab) {
      event.preventDefault();
      navigateShortcutTab(numericTab);
      return;
    }

    const quickJump: Record<string, Tab> = {
      a: "ai",
      s: "submissions",
      e: "event-settings",
      r: "release",
      w: "winners",
      p: "presentation",
    };
    const quickTab = quickJump[event.key.toLowerCase()];
    if (quickTab) {
      event.preventDefault();
      navigateShortcutTab(quickTab);
    }
  }, [moveShortcutTab, navigateShortcutTab]));

  const [eventSettings, setEventSettings] = useState(data.activeEvent);
  const [publishing, setPublishing] = useState(false);

  async function switchEvent(id: string) {
    await fetch("/api/admin/events", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, isActive: true }),
    });
    router.refresh();
  }

  async function handlePublishWinners() {
    if (!data.activeEvent) return;
    setPublishing(true);
    await fetch("/api/admin/events", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: data.activeEvent.id, publishWinners: true }),
    });
    router.refresh();
    setPublishing(false);
  }

  async function handleUnpublishWinners() {
    if (!data.activeEvent) return;
    setPublishing(true);
    await fetch("/api/admin/events", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: data.activeEvent.id, unpublishWinners: true }),
    });
    router.refresh();
    setPublishing(false);
  }

  const tabs: { value: Tab; label: string }[] = [
    { value: "overview", label: "Overview" },
    { value: "submissions", label: "Submissions" },
    { value: "readiness", label: "Readiness" },
    { value: "rankings", label: "Rankings" },
    { value: "judges", label: "Judges" },
    { value: "ai", label: "AI Reviews" },
    { value: "votes", label: "Audience Votes" },
    { value: "analytics", label: "Analytics" },
    { value: "export", label: "Export" },
    { value: "checklist", label: "Demo Checklist" },
    { value: "release", label: "Release Checklist" },
    { value: "presentation", label: "Presentation" },
    { value: "event-settings", label: "Event Settings" },
    { value: "winners", label: "Winners" },
  ];

  return (
    <div className="mx-auto max-w-7xl w-full px-4 sm:px-6 py-8 flex-1">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
          <div>
            <div style={{ fontSize: "0.8125rem", color: "var(--color-subtle)", marginBottom: "0.25rem" }}>
              Admin dashboard
            </div>
            <div className="flex items-center gap-3">
              {data.activeEvent?.logoUrl && (
                <img
                  src={data.activeEvent.logoUrl}
                  alt={data.activeEvent.displayName ?? data.activeEvent.name}
                  style={{ height: 28, maxWidth: 80, objectFit: "contain", display: "block", flexShrink: 0 }}
                />
              )}
              <h1
                style={{
                  fontFamily: "var(--font-headline)",
                  fontSize: "1.75rem",
                  fontWeight: 700,
                  letterSpacing: "-0.03em",
                  color: "var(--color-fg)",
                }}
              >
                {data.activeEvent?.displayName ?? data.activeEvent?.name ?? "Vibe Hackathon"}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <AdminIdentityChip session={data.adminSession} />
            {/* Event selector */}
            {data.allEvents.length > 1 && (
              <select
                value={data.activeEvent?.id ?? ""}
                onChange={(e) => switchEvent(e.target.value)}
                style={{
                  fontSize: "0.8125rem",
                  padding: "0.375rem 0.625rem",
                  borderRadius: 6,
                  border: "1px solid var(--color-border)",
                  background: "var(--color-surface-2)",
                  color: "var(--color-fg)",
                  cursor: "pointer",
                }}
              >
                {data.allEvents.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.displayName ?? ev.name}{ev.isActive ? " (active)" : ""}
                  </option>
                ))}
              </select>
            )}
            <DeadlineChip status={data.submissionDeadlineStatus} label="Submissions" />
            <DeadlineChip status={data.judgingDeadlineStatus} label="Judging" />
          </div>
        </div>

        {/* Tabs */}
        <div
          ref={tabListRef}
          className="flex gap-1 mb-8 border-b"
          style={{ borderColor: "var(--color-border)", overflowX: "auto", scrollbarWidth: "none" }}
        >
          {tabs.map((t) => (
            <button
              key={t.value}
              ref={(node) => {
                if (node) tabButtonRefs.current[t.value] = node;
                else delete tabButtonRefs.current[t.value];
              }}
              onClick={() => handleTabChange(t.value)}
              style={{
                padding: "0.5rem 1rem",
                fontSize: "0.875rem",
                fontWeight: 500,
                cursor: "pointer",
                background: "none",
                border: "none",
                borderBottom: t.value === tab ? "2px solid var(--color-accent)" : "2px solid transparent",
                color: t.value === tab ? "var(--color-fg)" : "var(--color-muted)",
                marginBottom: -1,
                transition: "color 140ms",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Overview */}
        {tab === "overview" && (
          <div className="flex flex-col gap-6">
            {data.eventHealth && <EventHealthPanel data={data.eventHealth} />}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatCard label="Total Teams" value={data.submissions.length} />
              <StatCard label="Finalized" value={data.finalizedCount} />
              <StatCard
                label="Scores Completed"
                value={data.completedScoresCount}
                suffix={`/${data.submissions.length * data.judges.length}`}
              />
              <StatCard label="Audience Votes" value={data.totalVotes} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatCard
                label="AI Reviews Done"
                value={data.completedAiReviews}
                suffix={`/${data.submissions.length}`}
                color
              />
              <StatCard label="Judges" value={data.judges.length} color />
              <StatCard label="Prize Pool" value="$10,000" isString color />
            </div>

            {/* Vote leaderboard */}
            <div>
              <h2 style={{ fontWeight: 600, color: "var(--color-fg)", marginBottom: "1rem", fontSize: "1rem" }}>
                Audience Vote Leaderboard
              </h2>
              <div className="flex flex-col gap-2">
                {[...data.submissions]
                  .sort((a, b) => b.voteCount - a.voteCount)
                  .slice(0, 5)
                  .map((sub, i) => (
                    <div
                      key={sub.id}
                      className="card"
                      style={{ padding: "0.875rem 1.125rem", display: "flex", alignItems: "center", gap: "1rem" }}
                    >
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: "1rem",
                          fontWeight: 700,
                          color: i === 0 ? "var(--color-warning)" : "var(--color-subtle)",
                          minWidth: "1.5rem",
                        }}
                      >
                        #{i + 1}
                      </span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 500, color: "var(--color-fg)", fontSize: "0.875rem" }}>
                          {sub.projectTitle ?? sub.teamName}
                        </div>
                        <TeamNameWithRoster
                          teamName={sub.teamName}
                          roster={data.teamRosters.find((roster) => roster.submissionId === sub.id)}
                          onViewTeam={setSelectedTeamRoster}
                          fontSize="0.75rem"
                        />
                      </div>
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontWeight: 700,
                          color: "var(--color-accent)",
                          fontSize: "1rem",
                        }}
                      >
                        {sub.voteCount}
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            {/* Quick links */}
            <div>
              <h2 style={{ fontWeight: 600, color: "var(--color-fg)", marginBottom: "0.75rem", fontSize: "1rem" }}>
                Quick Links
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { label: "Projects", href: "/projects" },
                  { label: "Submit", href: "/submit" },
                  { label: "Instructions", href: "/submit/instructions" },
                  { label: "Winners", href: "/winners" },
                  { label: "Presentation", href: "/presentation" },
                  { label: "Presentation Debug", href: "/presentation?debugPresentation=1" },
                  { label: "Agent Attribution Demo", href: "/admin/agent-attribution-demo" },
                  { label: "Verified Agent Artifacts", href: "/admin/verified-agent-artifacts" },
                  { label: "People & Access", href: "/admin/people" },
                  { label: "AI Reviews", href: "/admin/dashboard/ai-reviews" },
                  { label: "Export", href: "/admin/dashboard/export" },
                  { label: "API Spec", href: "/api/v1/spec" },
                  { label: "Demo Checklist", href: "/admin/dashboard/demo-checklist" },
                ].map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    target={link.href.startsWith("/api") ? "_blank" : undefined}
                    rel={link.href.startsWith("/api") ? "noopener noreferrer" : undefined}
                    className="card"
                    style={{
                      padding: "0.625rem 0.875rem",
                      fontSize: "0.8125rem",
                      fontWeight: 500,
                      color: "var(--color-fg)",
                      textDecoration: "none",
                      display: "block",
                      transition: "background 140ms",
                    }}
                  >
                    {link.label} <span style={{ color: "var(--color-subtle)" }}>↗</span>
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Submissions */}
        {tab === "submissions" && (
          <div className="flex flex-col gap-3">
            {data.submissions.map((sub) => (
              <div key={sub.id} className="card" style={{ padding: "1rem 1.25rem" }}>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <StatusBadge status={sub.status} />
                      {sub.aiReviewStatus && (
                        <span
                          className={`badge ${sub.aiReviewStatus === "complete" ? "badge-success" : "badge-default"}`}
                        >
                          AI: {sub.aiReviewStatus}
                        </span>
                      )}
                    </div>
                    <div style={{ fontWeight: 600, color: "var(--color-fg)", fontSize: "0.9375rem" }}>
                      {sub.projectTitle ?? sub.teamName}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", flexWrap: "wrap" }}>
                      <TeamNameWithRoster
                        teamName={sub.teamName}
                        roster={data.teamRosters.find((roster) => roster.submissionId === sub.id)}
                        onViewTeam={setSelectedTeamRoster}
                      />
                      <span style={{ fontSize: "0.8125rem", color: "var(--color-muted)" }}>· {sub.contactEmail}</span>
                    </div>
                    <div className="flex gap-2 flex-wrap" style={{ marginTop: "0.5rem" }}>
                      <span className="badge badge-default">
                        Owner: {sub.ownershipType === "github" && sub.ownerGithubLogin ? `${sub.ownerGithubLogin} (GitHub)` : "Badge Owner"}
                      </span>
                      <span className="badge badge-default">Team size: {sub.teamSize || "unknown"}</span>
                      <span className={`badge ${sub.prizeEligible ? "badge-success" : "badge-warning"}`}>Badge completion: {sub.badgeCount}/{sub.teamSize || 0}</span>
                      <span className={`badge ${sub.prizeEligible ? "badge-success" : "badge-warning"}`}>Prize: {sub.prizeEligible ? "eligible" : "incomplete"}</span>
                      <span className="badge badge-default">Student/trainee: {sub.studentTraineeCount}</span>
                      <span className={`badge ${sub.ownerBadgePresent ? "badge-success" : "badge-warning"}`}>Owner badge: {sub.ownerBadgePresent ? "present" : "missing"}</span>
                      <span className="badge badge-default">Badge verification: {sub.badgeVerificationStatus}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    {sub.avgHumanScore !== null && (
                      <div style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--color-accent)" }}>
                        {sub.avgHumanScore}/10
                      </div>
                    )}
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.875rem", color: "var(--color-muted)" }}>
                      ▲{sub.voteCount}
                    </span>
                    <div className="flex gap-1 flex-wrap">
                      <button
                        className="btn-ghost"
                        style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem" }}
                        onClick={() => alert(`Reproduction framework placeholder for ${sub.id}: clone repo, follow AGENTS.md, attempt install/run, capture evidence.`)}
                      >
                        Reproduce Project
                      </button>
                      <button
                        className="btn-ghost"
                        style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem" }}
                        onClick={() => alert(`Would toggle lock on ${sub.id}`)}
                      >
                        {sub.status === "locked" ? "Unlock" : "Lock"}
                      </button>
                      <button
                        className="btn-ghost"
                        style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem" }}
                        onClick={() => alert(`New token: edit_${Math.random().toString(36).slice(2, 10)}`)}
                      >
                        Regen token
                      </button>
                    </div>
                  </div>
                </div>
                <div
                  className="flex items-center gap-2 mt-2 pt-2 border-t"
                  style={{ borderColor: "var(--color-border)" }}
                >
                  <code style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--color-subtle)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
                    /submit/{sub.editToken}
                  </code>
                  {sub.demoUrl && (
                    <a
                      href={sub.demoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-ghost ml-auto"
                      style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem" }}
                    >
                      Demo ↗
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "readiness" && (
          <SubmissionReadinessTab
            rows={data.submissionReadiness}
            rosters={data.teamRosters}
            eventFrozen={Boolean(data.activeEvent?.isFrozen)}
            onViewTeam={setSelectedTeamRoster}
          />
        )}

        {/* Rankings */}
        {tab === "rankings" && (
          <div className="flex flex-col gap-4">
            {/* Publish winners card */}
            <div className="card" style={{ padding: "1rem 1.25rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
              <div>
                <div style={{ fontWeight: 600, color: "var(--color-fg)", marginBottom: "0.25rem" }}>
                  {data.activeEvent?.winnersPublishedAt ? "Winners published" : "Publish winners"}
                </div>
                <div style={{ fontSize: "0.8125rem", color: "var(--color-muted)" }}>
                  {data.activeEvent?.winnersPublishedAt
                    ? `Published ${data.activeEvent.winnersPublishedAt.slice(0, 10)}. Public winners page is live.`
                    : "Make the results public at /winners. Official top 3 and People's Choice will be shown."}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {data.activeEvent?.winnersPublishedAt ? (
                  <>
                    <Link href="/winners" className="btn-ghost" style={{ fontSize: "0.8125rem", padding: "0.375rem 0.75rem" }} target="_blank">
                      View /winners ↗
                    </Link>
                    <button onClick={handleUnpublishWinners} disabled={publishing} className="btn-secondary" style={{ fontSize: "0.8125rem" }}>
                      {publishing ? "…" : "Unpublish"}
                    </button>
                  </>
                ) : (
                  <button onClick={handlePublishWinners} disabled={publishing} className="btn-primary" style={{ fontSize: "0.8125rem" }}>
                    {publishing ? "Publishing…" : "Publish winners →"}
                  </button>
                )}
              </div>
            </div>

            <div className="card" style={{ padding: "1rem 1.25rem" }}>
              <div style={{ fontWeight: 600, color: "var(--color-fg)", marginBottom: "0.35rem" }}>
                Official ranking formula
              </div>
              <div style={{ fontSize: "0.875rem", color: "var(--color-muted)", lineHeight: 1.6 }}>
                Human judging 70% + deterministic AI reproducibility 30%. Audience voting is separate and produces
                People&apos;s Choice rankings only.
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {data.rankings.map((row) => (
                <div key={row.submissionId} className="card" style={{ padding: "1rem 1.25rem" }}>
                  <div className="flex items-start gap-4 flex-wrap">
                    <div style={{ fontFamily: "var(--font-mono)", fontWeight: 800, color: "var(--color-accent)", minWidth: "2.5rem", fontSize: "1.25rem" }}>
                      {row.rank ? `#${row.rank}` : "—"}
                    </div>
                    <div style={{ flex: 1, minWidth: "14rem" }}>
                      <div className="flex items-center gap-2 flex-wrap" style={{ marginBottom: "0.25rem" }}>
                        <span className={`badge ${row.rankStatus === "final" ? "badge-success" : row.rankStatus === "provisional" ? "badge-warning" : "badge-error"}`}>
                          {row.rankStatus}
                        </span>
                        {row.warnings.map((warning) => (
                          <span key={warning} className="badge badge-warning">{warning}</span>
                        ))}
                      </div>
                      <div style={{ fontWeight: 700, color: "var(--color-fg)" }}>{row.projectTitle ?? row.teamName}</div>
                      <TeamNameWithRoster
                        teamName={row.teamName}
                        roster={data.teamRosters.find((roster) => roster.submissionId === row.submissionId)}
                        onViewTeam={setSelectedTeamRoster}
                      />
                    </div>
                    <ScoreMetric label="Official" value={row.officialScore} suffix="/100" strong />
                    <ScoreMetric label="Human avg" value={row.humanAverageScore} suffix="/100" />
                    <ScoreMetric label="AI overall" value={row.aiOverallScore} suffix="/100" />
                    <ScoreMetric label="Votes" value={row.audienceVotes} />
                    <ScoreMetric label="Judges" value={`${row.judgeCompletionCount}/${row.totalAssignedJudges}`} isString />
                  </div>
                </div>
              ))}
            </div>
            <div>
              <h2 style={{ fontWeight: 600, color: "var(--color-fg)", marginBottom: "1rem" }}>
                People's Choice leaderboard
              </h2>
              <div className="flex flex-col gap-2">
                {data.peoplesChoiceRankings.slice(0, eventSettings?.audienceAwardCount ?? 1).map((row) => (
                  <div key={row.submissionId} className="card" style={{ padding: "0.875rem 1.125rem", display: "flex", alignItems: "center", gap: "1rem" }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontWeight: 800, color: "var(--color-warning)", minWidth: "2rem" }}>#{row.rank}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, color: "var(--color-fg)" }}>{row.projectTitle ?? row.teamName}</div>
                      <TeamNameWithRoster
                        teamName={row.teamName}
                        roster={data.teamRosters.find((roster) => roster.submissionId === row.submissionId)}
                        onViewTeam={setSelectedTeamRoster}
                      />
                    </div>
                    <span style={{ fontFamily: "var(--font-mono)", fontWeight: 800, color: "var(--color-accent)" }}>{row.audienceVotes}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Winners */}
        {tab === "winners" && eventSettings && (
          <div className="flex flex-col gap-4">
            <div className="card" style={{ padding: "1.25rem" }}>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h2 style={{ fontFamily: "var(--font-headline)", fontSize: "1.25rem", fontWeight: 800, color: "var(--color-fg)", marginBottom: "0.35rem" }}>
                    Winners preview and publishing
                  </h2>
                  <p style={{ color: "var(--color-muted)", fontSize: "0.875rem", lineHeight: 1.6 }}>
                    Preview the ceremony page before public release. Public visitors only see winners after publishing.
                  </p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Link href="/winners?preview=1" target="_blank" className="btn-secondary">Preview awards ↗</Link>
                  <Link href="/winners" target="_blank" className="btn-ghost">Public page ↗</Link>
                  {data.activeEvent?.winnersPublishedAt ? (
                    <button onClick={handleUnpublishWinners} disabled={publishing} className="btn-secondary">{publishing ? "…" : "Unpublish"}</button>
                  ) : (
                    <button onClick={handlePublishWinners} disabled={publishing} className="btn-primary">{publishing ? "Publishing…" : "Publish Winners"}</button>
                  )}
                </div>
              </div>
            </div>

            <div className="card" style={{ padding: "1.25rem" }}>
              <h3 style={{ fontWeight: 700, color: "var(--color-fg)", marginBottom: "1rem" }}>Award visibility</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  ["showJudgeChoice", "Judge Choice"],
                  ["showPeoplesChoice", "People's Choice"],
                  ["showAIChoice", "AI Choice"],
                  ["showSpecialAwards", "Special Awards"],
                ].map(([key, label]) => (
                  <label key={key} className="card" style={{ padding: "0.875rem", display: "flex", alignItems: "center", gap: "0.65rem", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={Boolean(eventSettings[key as keyof typeof eventSettings])}
                      onChange={(e) => setEventSettings({ ...eventSettings, [key]: e.target.checked })}
                    />
                    <span style={{ color: "var(--color-fg)", fontWeight: 600 }}>{label}</span>
                  </label>
                ))}
              </div>
              <button
                className="btn-primary"
                style={{ marginTop: "1rem" }}
                onClick={async () => {
                  await fetch("/api/admin/events", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(eventSettings) });
                  router.refresh();
                }}
              >
                Save award settings
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <StatCard label="Official ranked" value={data.rankings.filter((r) => r.officialScore !== null).length} />
              <StatCard label="People's Choice" value={data.peoplesChoiceRankings.length} />
              <StatCard label="AI eval runs" value={data.aiJudgeRuns.filter((r) => r.status === "complete").length} />
              <StatCard label="Published" value={data.activeEvent?.winnersPublishedAt ? "Yes" : "No"} isString color />
            </div>
          </div>
        )}

        {/* Judges */}
        {tab === "judges" && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between mb-2">
              <h2 style={{ fontWeight: 600, color: "var(--color-fg)" }}>
                Judges ({data.judges.length})
              </h2>
              <button
                className="btn-primary"
                style={{ fontSize: "0.875rem" }}
                onClick={() => alert("Create judge flow not yet implemented")}
              >
                + Create judge
              </button>
            </div>
            <div>
              <h2 style={{ fontWeight: 600, color: "var(--color-fg)", marginBottom: "1rem" }}>
                Judge calibration
              </h2>
              <div className="flex flex-col gap-2">
                {data.judgeCalibration.map((judge) => (
                  <div key={judge.judgeId} className="card" style={{ padding: "1rem 1.25rem" }}>
                    <div className="flex items-center gap-4 flex-wrap">
                      <div style={{ flex: 1, minWidth: "12rem" }}>
                        <div style={{ fontWeight: 600, color: "var(--color-fg)" }}>{judge.judgeName}</div>
                        <div style={{ fontSize: "0.8125rem", color: "var(--color-muted)" }}>{judge.judgeEmail}</div>
                      </div>
                      <ScoreMetric label="Completed" value={`${judge.reviewsCompleted}/${judge.reviewsAssigned}`} isString />
                      <ScoreMetric label="Avg given" value={judge.averageScoreGiven} suffix="/100" />
                      <ScoreMetric label="Std dev" value={judge.standardDeviation} />
                      <ScoreMetric label="Avg deviation" value={judge.averageDeviationFromPanelMean} />
                      <div>
                        <div style={{ fontSize: "0.6875rem", color: "var(--color-subtle)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.25rem" }}>
                          Outliers
                        </div>
                        <span className={`badge ${judge.outlierCount > 0 ? "badge-warning" : "badge-success"}`}>
                          {judge.outlierCount}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {data.judges.map((judge) => (
              <div key={judge.id} className="card" style={{ padding: "1.125rem" }}>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <div style={{ fontWeight: 600, color: "var(--color-fg)", marginBottom: "0.25rem" }}>
                      {judge.name}
                    </div>
                    <div style={{ fontSize: "0.8125rem", color: "var(--color-muted)" }}>{judge.email}</div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <div
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontWeight: 700,
                          color: "var(--color-accent)",
                          fontSize: "1.25rem",
                          lineHeight: 1,
                        }}
                      >
                        {judge.completedCount}/{judge.assignedCount}
                      </div>
                      <div
                        style={{
                          fontSize: "0.625rem",
                          color: "var(--color-subtle)",
                          marginTop: "0.2rem",
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                        }}
                      >
                        Done
                      </div>
                    </div>
                  </div>
                </div>
                <div
                  className="flex items-center gap-3 mt-3 pt-3 border-t flex-wrap"
                  style={{ borderColor: "var(--color-border)" }}
                >
                  <span style={{ fontSize: "0.75rem", color: "var(--color-subtle)" }}>
                    Judge credentials are managed server-side.
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* AI Reviews */}
        {tab === "ai" && (
          <AiReviewsTab
            submissions={data.submissions}
            aiJudgeRuns={data.aiJudgeRuns}
            baseUrl={data.baseUrl}
            rosters={data.teamRosters}
            onViewTeam={setSelectedTeamRoster}
          />
        )}

        {/* Audience Votes */}
        {tab === "votes" && (
          <div className="flex flex-col gap-4">
            {/* Metrics row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="Total Votes" value={data.totalVotes} />
              <StatCard label="Unique Voters" value={data.audienceVoterCount} />
              <StatCard label="With Email" value={data.audienceEmailCaptureCount} />
              <StatCard label="People's Choice Awards" value={data.activeEvent?.audienceAwardCount ?? 1} color />
              <StatCard label="Live Results" value={(data.activeEvent?.audienceResultsVisible) ? "Visible" : "Hidden"} isString color />
            </div>

            {/* Settings */}
            {eventSettings && (
              <div className="card" style={{ padding: "1.25rem" }}>
                <div style={{ fontWeight: 600, color: "var(--color-fg)", marginBottom: "0.75rem" }}>Audience voting settings</div>

                {/* Quick toggles */}
                <div className="flex gap-2 flex-wrap mb-1">
                  <button
                    className={eventSettings.audienceVotingEnabled ? "btn-primary" : "btn-secondary"}
                    style={{ fontSize: "0.8125rem" }}
                    onClick={async () => {
                      const next = { ...eventSettings, audienceVotingEnabled: true, audienceVotingMode: "human" };
                      setEventSettings(next);
                      await fetch("/api/admin/events", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: next.id, audienceVotingEnabled: true, audienceVotingMode: "human" }) });
                      router.refresh();
                    }}
                  >
                    Open Voting
                  </button>
                  <button
                    className={!eventSettings.audienceVotingEnabled ? "btn-primary" : "btn-secondary"}
                    style={{ fontSize: "0.8125rem" }}
                    onClick={async () => {
                      const next = { ...eventSettings, audienceVotingEnabled: false };
                      setEventSettings(next);
                      await fetch("/api/admin/events", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: next.id, audienceVotingEnabled: false }) });
                      router.refresh();
                    }}
                  >
                    Close Voting
                  </button>
                  <a href="/audience" target="_blank" rel="noopener noreferrer" className="btn-ghost" style={{ fontSize: "0.8125rem" }}>
                    View /audience ↗
                  </a>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                  <label style={{ fontSize: "0.8125rem", color: "var(--color-muted)" }}>
                    Voting mode
                    <select
                      value={eventSettings.audienceVotingMode ?? "disabled"}
                      onChange={(e) => setEventSettings({ ...eventSettings, audienceVotingMode: e.target.value })}
                      style={{ display: "block", width: "100%", marginTop: "0.25rem", background: "var(--color-surface)", color: "var(--color-fg)", border: "1px solid var(--color-border)", borderRadius: 8, padding: "0.4rem" }}
                    >
                      <option value="disabled">Disabled</option>
                      <option value="human">Human (badge / email / code)</option>
                    </select>
                  </label>
                  <label style={{ fontSize: "0.8125rem", color: "var(--color-muted)" }}>
                    Identity method
                    <select
                      value={eventSettings.audienceIdentityMethod ?? "anonymous"}
                      onChange={(e) => setEventSettings({ ...eventSettings, audienceIdentityMethod: e.target.value })}
                      style={{ display: "block", width: "100%", marginTop: "0.25rem", background: "var(--color-surface)", color: "var(--color-fg)", border: "1px solid var(--color-border)", borderRadius: 8, padding: "0.4rem" }}
                    >
                      <option value="anonymous">Anonymous (session fingerprint)</option>
                      <option value="badge">Badge number</option>
                      <option value="email">Email address</option>
                      <option value="invite_code">Invite code</option>
                    </select>
                  </label>
                  <label style={{ fontSize: "0.8125rem", color: "var(--color-muted)" }}>
                    People&apos;s Choice awards
                    <select value={eventSettings.audienceAwardCount} onChange={(e) => setEventSettings({ ...eventSettings, audienceAwardCount: Number(e.target.value) })} style={{ display: "block", width: "100%", marginTop: "0.25rem", background: "var(--color-surface)", color: "var(--color-fg)", border: "1px solid var(--color-border)", borderRadius: 8, padding: "0.4rem" }}>
                      <option value={1}>Top 1</option>
                      <option value={2}>Top 2</option>
                      <option value={3}>Top 3</option>
                    </select>
                  </label>
                  <label style={{ fontSize: "0.8125rem", color: "var(--color-muted)" }}>
                    Votes per person
                    <select value={eventSettings.audienceVotesPerPerson} onChange={(e) => setEventSettings({ ...eventSettings, audienceVotesPerPerson: Number(e.target.value) })} style={{ display: "block", width: "100%", marginTop: "0.25rem", background: "var(--color-surface)", color: "var(--color-fg)", border: "1px solid var(--color-border)", borderRadius: 8, padding: "0.4rem" }}>
                      <option value={1}>1</option>
                      <option value={3}>3</option>
                    </select>
                  </label>
                  <label style={{ fontSize: "0.8125rem", color: "var(--color-muted)" }}>
                    Voting starts
                    <input type="datetime-local" value={(eventSettings.audienceVotingStartsAt ?? "").slice(0, 16)} onChange={(e) => setEventSettings({ ...eventSettings, audienceVotingStartsAt: e.target.value })} style={{ display: "block", width: "100%", marginTop: "0.25rem", background: "var(--color-surface)", color: "var(--color-fg)", border: "1px solid var(--color-border)", borderRadius: 8, padding: "0.4rem" }} />
                  </label>
                  <label style={{ fontSize: "0.8125rem", color: "var(--color-muted)" }}>
                    Voting ends
                    <input type="datetime-local" value={(eventSettings.audienceVotingEndsAt ?? "").slice(0, 16)} onChange={(e) => setEventSettings({ ...eventSettings, audienceVotingEndsAt: e.target.value })} style={{ display: "block", width: "100%", marginTop: "0.25rem", background: "var(--color-surface)", color: "var(--color-fg)", border: "1px solid var(--color-border)", borderRadius: 8, padding: "0.4rem" }} />
                  </label>
                </div>
                <label style={{ fontSize: "0.8125rem", color: "var(--color-muted)", display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.75rem" }}>
                  <input type="checkbox" checked={eventSettings.audienceResultsVisible} onChange={(e) => setEventSettings({ ...eventSettings, audienceResultsVisible: e.target.checked })} />
                  Show live results on /audience and /projects
                </label>
                <button
                  className="btn-primary"
                  style={{ marginTop: "1rem", fontSize: "0.875rem" }}
                  onClick={async () => {
                    await fetch("/api/admin/events", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(eventSettings) });
                    router.refresh();
                  }}
                >
                  Save audience settings
                </button>
              </div>
            )}

            {/* Vote leaderboard */}
            <div>
              <h2 style={{ fontWeight: 600, color: "var(--color-fg)", marginBottom: "0.75rem", fontSize: "1rem" }}>
                People&apos;s Choice Standings
              </h2>
              <div className="flex flex-col gap-2">
                {(() => {
                  const maxVotes = Math.max(...data.submissions.map((s) => s.voteCount), 1);
                  return [...data.submissions]
                    .sort((a, b) => b.voteCount - a.voteCount)
                    .map((sub, i) => (
                      <div key={sub.id} className="card" style={{ padding: "0.875rem 1.125rem", display: "flex", alignItems: "center", gap: "1rem" }}>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.875rem", color: "var(--color-subtle)", minWidth: "1.5rem" }}>#{i + 1}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 500, color: "var(--color-fg)", fontSize: "0.875rem" }}>{sub.projectTitle ?? sub.teamName}</div>
                          <TeamNameWithRoster
                            teamName={sub.teamName}
                            roster={data.teamRosters.find((roster) => roster.submissionId === sub.id)}
                            onViewTeam={setSelectedTeamRoster}
                            fontSize="0.75rem"
                          />
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                          <div style={{ width: 120, height: 4, background: "var(--color-surface-2)", borderRadius: 999, overflow: "hidden" }}>
                            <div style={{ width: `${(sub.voteCount / maxVotes) * 100}%`, height: "100%", background: "var(--color-accent)", borderRadius: 999 }} />
                          </div>
                          <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--color-fg)", minWidth: "2.5rem", textAlign: "right" }}>{sub.voteCount}</span>
                        </div>
                      </div>
                    ));
                })()}
              </div>
            </div>
          </div>
        )}

        {/* Analytics */}
        {tab === "analytics" && (
          <AnalyticsTab data={data.analytics} />
        )}

        {/* Export */}
        {tab === "export" && (
          <div className="flex flex-col gap-4 max-w-lg">
            <ExportCard title="Event bundle" dataset="event-bundle" description="Portable JSON bundle with event, submissions, teams, scores, votes, rankings, and winners." jsonOnly />
            <ExportCard title="Submissions" dataset="submissions" description="All submitted project metadata and artifact URLs." />
            <ExportCard title="Human scores" dataset="human_scores" description="Completed and incomplete judge score summaries." />
            <ExportCard title="AI review scores" dataset="ai_reviews" description="Deterministic AI review rows and scoring details." />
            <ExportCard title="Audience votes" dataset="audience_votes" description="Raw audience vote records." />
            <ExportCard title="Final rankings" dataset="final_rankings" description="Computed official ranking table and warning badges." />
            <ExportCard title="People's Choice" dataset="peoples_choice" description="Audience-only People's Choice ranking results." />
            <ExportCard title="Judge calibration" dataset="judge_calibration" description="Per-judge completion, variance, deviation, and outlier counts." />
            <ExportCard title="Team roster" dataset="team_roster" description="Admin-only member roster with emails, badge numbers, degrees, institutions, and prize eligibility." />
          </div>
        )}

        {/* Demo Checklist */}
        {tab === "checklist" && (
          <DemoChecklistTab data={data} />
        )}

        {tab === "release" && (
          <ReleaseChecklistTab data={data} />
        )}

        {tab === "presentation" && (
          <PresentationOpsTab data={data} />
        )}

        {tab === "event-settings" && eventSettings && (
          <EventSettingsTab eventSettings={eventSettings} setEventSettings={setEventSettings} routerRefresh={() => router.refresh()} />
        )}
        <TeamRosterModal roster={selectedTeamRoster} onClose={() => setSelectedTeamRoster(null)} />
        <ShortcutHelpOverlay open={showHelp} onClose={() => setShowHelp(false)} showAdmin />
      </div>
  );
}

function AdminIdentityChip({ session }: { session: AdminIdentitySession }) {
  const methodLabels: Record<string, string> = {
    signup_face_enrollment: "Face enrollment",
    face_identify: "Face identify",
    manual_user_confirmed_match: "User-confirmed match",
    development_fallback: "Development fallback",
    better_auth_session: "Better Auth session",
    better_auth_viby: "Viby verification",
  };
  const method = session.identity_method ? methodLabels[session.identity_method] ?? session.identity_method : "identity";
  const sessionCaption = adminSessionCaption(session);
  const confidence = typeof session.identity_confidence === "number"
    ? `${Math.round(session.identity_confidence * 100)}%`
    : null;
  const expiresAt = new Date(session.expires_at);
  const expiresLabel = Number.isNaN(expiresAt.getTime())
    ? null
    : expiresAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return (
    <div
      className="flex items-start gap-3"
      data-testid="admin-identity-card"
      style={{
        border: "1px solid color-mix(in srgb, var(--color-success) 35%, transparent)",
        background: "color-mix(in srgb, var(--color-success) 10%, transparent)",
        borderRadius: 14,
        padding: "0.65rem 0.7rem 0.65rem 0.8rem",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ color: "var(--color-muted)", fontSize: "0.65rem", fontWeight: 850, letterSpacing: "0.08em", lineHeight: 1.2, textTransform: "uppercase" }}>
          Admin identity
        </div>
        <div style={{ color: "var(--color-fg)", fontSize: "0.875rem", fontWeight: 850, lineHeight: 1.15, marginTop: 2 }}>
          {session.display_name}
        </div>
        <div style={{ color: "var(--color-muted)", fontSize: "0.7rem", lineHeight: 1.25, marginBottom: "0.35rem" }}>
          {sessionCaption}
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "auto auto",
            columnGap: "0.65rem",
            rowGap: "0.15rem",
            color: "var(--color-muted)",
            fontSize: "0.6875rem",
            lineHeight: 1.25,
          }}
        >
          <span style={{ color: "var(--color-subtle)", fontWeight: 750 }}>Method:</span>
          <span>{method}</span>
          {confidence && (
            <>
              <span style={{ color: "var(--color-subtle)", fontWeight: 750 }}>Confidence:</span>
              <span>{confidence}</span>
            </>
          )}
          {expiresLabel && (
            <>
              <span style={{ color: "var(--color-subtle)", fontWeight: 750 }}>Expires:</span>
              <span>{expiresLabel}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

type ReadinessFilter =
  | "all"
  | "ready"
  | "incomplete"
  | "finalized"
  | "prize-eligible"
  | "prize-ineligible"
  | "missing-teamEligibility"
  | "missing-screenshotUrls"
  | "missing-demoUrl"
  | "missing-githubUrl"
  | "missing-agentsMdUrl";

const readinessIconButtonStyle = {
  width: 32,
  height: 32,
  padding: 0,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "0.86rem",
  lineHeight: 1,
  flexShrink: 0,
} as const;

function TeamRosterButton({
  roster,
  onViewTeam,
}: {
  roster: AdminTeamRosterRow | null | undefined;
  onViewTeam: (roster: AdminTeamRosterRow | null) => void;
}) {
  return (
    <button
      type="button"
      className="btn-ghost"
      title="View Team Roster"
      aria-label="View Team Roster"
      onClick={() => onViewTeam(roster ?? null)}
      style={{
        ...readinessIconButtonStyle,
        width: 28,
        height: 28,
        fontSize: "0.78rem",
      }}
    >
      👥
    </button>
  );
}

function TeamNameWithRoster({
  teamName,
  roster,
  onViewTeam,
  muted = true,
  fontSize = "0.8125rem",
}: {
  teamName: string;
  roster: AdminTeamRosterRow | null | undefined;
  onViewTeam: (roster: AdminTeamRosterRow | null) => void;
  muted?: boolean;
  fontSize?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.35rem",
        minWidth: 0,
        color: muted ? "var(--color-muted)" : "var(--color-fg)",
        fontSize,
      }}
      title={teamName}
    >
      <TeamRosterButton roster={roster} onViewTeam={onViewTeam} />
      <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {teamName}
      </span>
    </div>
  );
}

function SubmissionReadinessTab({
  rows,
  rosters,
  eventFrozen,
  onViewTeam,
}: {
  rows: SubmissionReadinessRow[];
  rosters: AdminTeamRosterRow[];
  eventFrozen: boolean;
  onViewTeam: (roster: AdminTeamRosterRow | null) => void;
}) {
  const [filters, setFilters] = useState<Set<ReadinessFilter>>(new Set(["all"]));
  const [sort, setSort] = useState<"completion" | "updated" | "project" | "status">("completion");
  const readyCount = rows.filter((row) => row.readinessStatus === "ready").length;
  const incompleteCount = rows.filter((row) => row.readinessStatus === "incomplete").length;
  const finalizedCount = rows.filter((row) => row.readinessStatus === "finalized").length;
  const prizeEligibleCount = rows.filter((row) => row.teamEligible).length;
  const avgCompletion = rows.length ? Math.round(rows.reduce((sum, row) => sum + row.completionPercent, 0) / rows.length) : 0;

  function toggleFilter(filter: ReadinessFilter) {
    setFilters((current) => {
      const next = new Set(current);
      if (filter === "all") return new Set(["all"]);
      next.delete("all");
      if (next.has(filter)) next.delete(filter);
      else next.add(filter);
      if (next.size === 0) next.add("all");
      return next;
    });
  }

  const visible = rows
    .filter((row) => {
      if (filters.has("all")) return true;
      for (const filter of filters) {
        if (filter === "ready" && row.readinessStatus !== "ready") return false;
        if (filter === "incomplete" && row.readinessStatus !== "incomplete") return false;
        if (filter === "finalized" && row.readinessStatus !== "finalized") return false;
        if (filter === "prize-eligible" && !row.teamEligible) return false;
        if (filter === "prize-ineligible" && row.teamEligible) return false;
        if (filter.startsWith("missing-")) {
          const key = filter.replace("missing-", "");
          if (!row.missingItems.some((item) => item.key === key)) return false;
        }
      }
      return true;
    })
    .sort((a, b) => {
      if (sort === "updated") return new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime();
      if (sort === "project") return (a.projectTitle ?? a.teamName).localeCompare(b.projectTitle ?? b.teamName);
      if (sort === "status") return a.readinessStatus.localeCompare(b.readinessStatus) || a.completionPercent - b.completionPercent;
      return a.completionPercent - b.completionPercent;
    });

  function exportCsv() {
    const header = ["Project", "Team", "Status", "Completion", "Team Eligibility", "Prize Eligible", "Badge Completion", "Student/Trainee Count", "Missing Items", "Updated"];
    const csvRows = visible.map((row) => [
      row.projectTitle ?? row.teamName,
      row.teamName,
      row.status,
      `${row.completeCount}/${row.totalCount} (${row.completionPercent}%)`,
      row.teamEligible ? "Eligible" : "Incomplete",
      row.teamEligible ? "Yes" : "No",
      `${row.badgeCount}/${row.memberCount}`,
      row.studentTraineeCount,
      row.missingItems.length ? row.missingItems.map((item) => item.label).join("; ") : row.readinessStatus === "finalized" ? "Finalized" : "Ready",
      row.updatedAt ?? "",
    ]);
    const csv = [header, ...csvRows].map((line) => line.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "submission-readiness.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const filterOptions: Array<{ value: ReadinessFilter; label: string }> = [
    { value: "all", label: "All" },
    { value: "ready", label: "Ready to Finalize" },
    { value: "incomplete", label: "Incomplete" },
    { value: "finalized", label: "Finalized" },
    { value: "prize-eligible", label: "Prize Eligible" },
    { value: "prize-ineligible", label: "Prize Ineligible" },
    { value: "missing-teamEligibility", label: "Missing Team Eligibility" },
    { value: "missing-screenshotUrls", label: "Missing Screenshots" },
    { value: "missing-demoUrl", label: "Missing Demo" },
    { value: "missing-githubUrl", label: "Missing GitHub" },
    { value: "missing-agentsMdUrl", label: "Missing AGENTS.md" },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 style={{ color: "var(--color-fg)", fontWeight: 850, fontSize: "1.25rem", marginBottom: "0.35rem" }}>Submission Readiness</h2>
        <p style={{ color: "var(--color-muted)", fontSize: "0.875rem", lineHeight: 1.6 }}>Find teams that need help before the submission deadline.</p>
      </div>
      <div
        className="card"
        style={{
          padding: "0.875rem 1rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ color: "var(--color-muted)", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 800 }}>Event Status</div>
          <div style={{ color: "var(--color-fg)", fontWeight: 850, marginTop: "0.2rem" }}>{eventFrozen ? "FROZEN" : "OPEN"}</div>
        </div>
        <span className="badge" style={{ border: `1px solid ${eventFrozen ? "var(--color-warning)" : "var(--color-success)"}`, color: eventFrozen ? "var(--color-warning)" : "var(--color-success)" }}>
          {eventFrozen ? "🏁 Event Frozen" : "🟢 Event Open"}
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        <StatCard label="Total Teams" value={rows.length} />
        <StatCard label="Ready to Finalize" value={readyCount} color />
        <StatCard label="Incomplete" value={incompleteCount} />
        <StatCard label="Prize Eligible" value={prizeEligibleCount} color />
        <StatCard label="Finalized" value={finalizedCount} color />
        <StatCard label="Avg Completion" value={`${avgCompletion}%`} isString color />
      </div>
      <div className="card" style={{ padding: "1rem" }}>
        <div className="flex flex-wrap gap-2" style={{ marginBottom: "0.875rem" }}>
          {filterOptions.map((option) => (
            <button key={option.value} type="button" className={filters.has(option.value) ? "btn-primary" : "btn-secondary"} onClick={() => toggleFilter(option.value)} style={{ fontSize: "0.75rem", padding: "0.35rem 0.7rem" }}>
              {option.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <label style={{ color: "var(--color-muted)", fontSize: "0.8125rem" }}>Sort</label>
          <select className="input" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} style={{ width: "auto", minWidth: 180 }}>
            <option value="completion">Completion %</option>
            <option value="updated">Last Updated</option>
            <option value="project">Project Name</option>
            <option value="status">Status</option>
          </select>
          <button type="button" className="btn-secondary" onClick={exportCsv} style={{ marginLeft: "auto" }}>Export CSV</button>
        </div>
      </div>
      <div className="card" style={{ overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
            <thead>
              <tr style={{ background: "var(--color-surface-2)", color: "var(--color-subtle)", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {[
                  ["Project", undefined],
                  ["Team", 150],
                  ["Status", 120],
                  ["Completion", 112],
                  ["Team Eligibility", 132],
                  ["Missing Items", undefined],
                  ["Updated", 96],
                  ["Actions", 78],
                ].map(([heading, width]) => (
                  <th key={heading} style={{ textAlign: "left", padding: "0.65rem 0.7rem", borderBottom: "1px solid var(--color-border)", width, whiteSpace: "nowrap" }}>{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ padding: "2rem", textAlign: "center", color: "var(--color-muted)" }}>
                    No submissions match the current readiness filters.
                  </td>
                </tr>
              )}
              {visible.map((row) => (
                <tr key={row.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                  <td style={{ padding: "0.65rem 0.7rem", color: "var(--color-fg)", fontWeight: 750 }}>{row.projectTitle ?? "Untitled project"}</td>
                  <td style={{ padding: "0.65rem 0.7rem", maxWidth: 170 }}>
                    <TeamNameWithRoster
                      teamName={row.teamName}
                      roster={rosters.find((roster) => roster.submissionId === row.id)}
                      onViewTeam={onViewTeam}
                    />
                  </td>
                  <td style={{ padding: "0.65rem 0.7rem", whiteSpace: "nowrap" }}><ReadinessBadge row={row} /></td>
                  <td style={{ padding: "0.65rem 0.7rem", color: "var(--color-fg)", fontFamily: "var(--font-mono)", whiteSpace: "nowrap" }} title={readinessTooltip(row)}>{row.completeCount} / {row.totalCount} <span style={{ color: "var(--color-subtle)" }}>({row.completionPercent}%)</span></td>
                  <td style={{ padding: "0.65rem 0.7rem", whiteSpace: "nowrap" }}><span className={`badge ${row.teamEligible ? "badge-success" : "badge-warning"}`}>{row.teamEligible ? "Eligible" : "Incomplete"}</span></td>
                  <td style={{ padding: "0.65rem 0.7rem" }}>
                    <div className="flex flex-wrap gap-1">
                      {row.missingItems.length === 0 ? <span className="badge badge-success">{row.readinessStatus === "finalized" ? "Finalized" : "Ready"}</span> : row.missingItems.slice(0, 5).map((item) => <span key={item.key} className="badge badge-warning">{item.label}</span>)}
                      {row.missingItems.length > 5 && <span className="badge badge-default" title={row.missingItems.slice(5).map((item) => item.label).join(", ")}>+{row.missingItems.length - 5} more</span>}
                    </div>
                  </td>
                  <td style={{ padding: "0.65rem 0.7rem", color: "var(--color-subtle)", fontSize: "0.8125rem", whiteSpace: "nowrap" }}>{row.updatedAt ? new Date(row.updatedAt).toLocaleDateString() : "—"}</td>
                  <td style={{ padding: "0.65rem 0.7rem", width: 78 }}>
                    <div className="flex items-center gap-1" style={{ flexWrap: "nowrap", whiteSpace: "nowrap" }}>
                      <Link href={`/project/${row.id}`} className="btn-ghost" title="Open Project" aria-label="Open Project" style={readinessIconButtonStyle}>↗</Link>
                      <Link href={`/submit/${row.editToken}/preview`} className="btn-ghost" title="Preview Submission" aria-label="Preview Submission" style={readinessIconButtonStyle}>👁</Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function readinessTooltip(row: SubmissionReadinessRow) {
  const missing = row.missingItems.map((item) => item.label);
  const completedCount = row.totalCount - missing.length;
  return [
    `Completed: ${completedCount}/${row.totalCount}`,
    missing.length ? `Missing:\n- ${missing.join("\n- ")}` : "Missing: none",
  ].join("\n\n");
}

function TeamRosterModal({ roster, onClose }: { roster: AdminTeamRosterRow | null; onClose: () => void }) {
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!roster) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [roster, onClose]);

  if (!roster) return null;
  const membersWithEmail = roster.members.filter((member) => member.email);
  const teamContacts = membersWithEmail.map((member) => `${member.name} <${member.email}>`);
  const teamMailto = `mailto:${membersWithEmail.map((member) => member.email).join(";")}`;
  const hasTeamEmails = membersWithEmail.length > 0;

  async function copyText(text: string, message: string) {
    await navigator.clipboard.writeText(text);
    setToast(message);
    window.setTimeout(() => setToast(null), 1800);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Team roster"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(0,0,0,0.58)",
        display: "flex",
        justifyContent: "flex-end",
      }}
      onClick={onClose}
    >
      <aside
        className="card"
        style={{
          width: "min(720px, 100vw)",
          height: "100%",
          borderRadius: 0,
          overflowY: "auto",
          padding: "1.25rem",
          borderTop: 0,
          borderRight: 0,
          borderBottom: 0,
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3" style={{ marginBottom: "1rem" }}>
          <div>
            <h2 style={{ color: "var(--color-fg)", fontWeight: 850, fontSize: "1.25rem", marginBottom: "0.25rem" }}>Team Roster</h2>
            <p style={{ color: "var(--color-muted)", fontSize: "0.875rem" }}>
              {roster.projectTitle ?? roster.teamName} · {roster.teamName}
            </p>
          </div>
          <button type="button" className="btn-secondary" onClick={onClose}>Close</button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" style={{ marginBottom: "1rem" }}>
          <MiniStat label="Team size" value={roster.teamSize} />
          <MiniStat label="Badges" value={`${roster.badgeCount}/${roster.teamSize}`} />
          <MiniStat label="Prize" value={roster.prizeEligible ? "Eligible" : "Incomplete"} />
          <MiniStat label="Students" value={roster.studentTraineeCount} />
        </div>
        <div className="flex flex-wrap gap-2" style={{ marginBottom: "1rem" }}>
          <button
            type="button"
            className="btn-secondary"
            disabled={!hasTeamEmails}
            title={hasTeamEmails ? "Copy all team contacts" : "No team emails available"}
            style={{ fontSize: "0.8125rem", opacity: hasTeamEmails ? 1 : 0.55 }}
            onClick={() => copyText(teamContacts.join("\n"), `Copied ${teamContacts.length} team contacts`)}
          >
            📋 Copy Team Contacts
          </button>
          <a
            className="btn-secondary"
            href={hasTeamEmails ? teamMailto : undefined}
            aria-disabled={!hasTeamEmails}
            title={hasTeamEmails ? "Email entire team" : "No team emails available"}
            style={{ fontSize: "0.8125rem", opacity: hasTeamEmails ? 1 : 0.55, pointerEvents: hasTeamEmails ? "auto" : "none" }}
          >
            ✉ Email Team
          </a>
          {toast && (
            <span className="badge badge-success" role="status" style={{ alignSelf: "center" }}>
              {toast}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2" style={{ marginBottom: "1rem" }}>
          <span className="badge badge-default">
            Owner: {roster.ownershipType === "github" && roster.ownerGithubLogin ? `${roster.ownerGithubLogin} (GitHub)` : "Badge owner"}
          </span>
          <span className={`badge ${roster.prizeEligible ? "badge-success" : "badge-warning"}`}>
            Prize eligibility: {roster.prizeEligible ? "complete" : "incomplete"}
          </span>
        </div>

        {roster.members.length === 0 ? (
          <p style={{ color: "var(--color-muted)", fontSize: "0.875rem", lineHeight: 1.65 }}>
            No team roster is available for this submission.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {roster.members.map((member, index) => (
              <div
                key={`${member.name}-${index}`}
                style={{
                  border: "1px solid var(--color-border)",
                  background: "var(--color-surface-2)",
                  borderRadius: 14,
                  padding: "0.95rem",
                }}
              >
                <div className="flex items-start justify-between gap-2" style={{ marginBottom: "0.65rem" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: "var(--color-fg)", fontWeight: 850, lineHeight: 1.2 }}>{member.name}</div>
                    <div className="flex items-start gap-2" style={{ marginTop: "0.35rem", flexWrap: "wrap" }}>
                      <div style={{ flex: 1, color: member.email ? "var(--color-muted)" : "var(--color-warning)", fontFamily: "var(--font-mono)", fontSize: "0.73rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: "10rem" }}>
                        {member.email || "Missing email"}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2" style={{ flexShrink: 0 }}>
                    <span className={`badge ${member.role === "Team Lead" ? "badge-success" : "badge-default"}`} style={{ flexShrink: 0 }}>
                      {member.role}
                    </span>
                    {member.email && (
                      <div className="flex gap-1 justify-end" style={{ flexShrink: 0, flexWrap: "wrap" }}>
                        <a
                          href={`mailto:${member.email}`}
                          className="btn-ghost"
                          title={`Email ${member.name}`}
                          aria-label={`Email ${member.name}`}
                          style={{ width: 32, height: 32, padding: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "0.9rem" }}
                        >
                          ✉
                        </a>
                        <button
                          type="button"
                          className="btn-ghost"
                          title="Copy contact"
                          aria-label={`Copy contact for ${member.name}`}
                          style={{ width: 32, height: 32, padding: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "0.9rem" }}
                          onClick={() => copyText(`${member.name} <${member.email}>`, "Copied contact")}
                        >
                          📋
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <RosterField label="Badge #" value={member.badgeNumber || "Missing badge"} tone={member.badgeNumber ? "mono" : "warning"} />
                  <RosterField label="Degree(s)" value={member.degrees || "—"} />
                  <RosterField label="Institution" value={member.affiliation || "—"} />
                  <RosterField label="Student/Trainee" value={member.isStudentTrainee ? "Yes" : "—"} tone={member.isStudentTrainee ? "success" : "muted"} />
                  <div className="flex items-center justify-between gap-3" style={{ borderTop: "1px solid var(--color-border)", paddingTop: "0.65rem", marginTop: "0.15rem" }}>
                    <span style={{ color: "var(--color-subtle)", fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 800 }}>
                      Verification
                    </span>
                    <span className={`badge ${member.badgeNumber ? "badge-default" : "badge-warning"}`}>{member.badgeVerificationStatus || "unknown"}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </aside>
    </div>
  );
}

function RosterField({
  label,
  value,
  tone = "muted",
}: {
  label: string;
  value: string;
  tone?: "muted" | "mono" | "warning" | "success";
}) {
  const color = tone === "warning"
    ? "var(--color-warning)"
    : tone === "success"
    ? "var(--color-success)"
    : "var(--color-muted)";

  return (
    <div className="flex items-start justify-between gap-3">
      <span style={{ color: "var(--color-subtle)", fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 800, flexShrink: 0 }}>
        {label}
      </span>
      <span style={{ color, fontFamily: tone === "mono" ? "var(--font-mono)" : undefined, fontSize: "0.82rem", textAlign: "right", overflowWrap: "anywhere" }}>
        {value}
      </span>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ padding: "0.7rem", border: "1px solid var(--color-border)", borderRadius: 10, background: "var(--color-surface-2)" }}>
      <div style={{ color: "var(--color-subtle)", fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.2rem" }}>{label}</div>
      <div style={{ color: "var(--color-fg)", fontWeight: 850 }}>{value}</div>
    </div>
  );
}

function ReadinessBadge({ row }: { row: SubmissionReadinessRow }) {
  const baseStyle = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    whiteSpace: "nowrap",
  } as const;
  if (row.readinessStatus === "finalized") return <span className="badge badge-2" style={baseStyle}>✓ Finalized</span>;
  if (row.readinessStatus === "ready") return <span className="badge badge-success" style={baseStyle}>✓ Ready</span>;
  return <span className="badge badge-warning" style={baseStyle}>⚠ Incomplete</span>;
}

function ScoreMetric({
  label,
  value,
  suffix,
  strong,
  isString,
}: {
  label: string;
  value: number | string | null;
  suffix?: string;
  strong?: boolean;
  isString?: boolean;
}) {
  return (
    <div style={{ minWidth: "5rem" }}>
      <div style={{ fontSize: "0.6875rem", color: "var(--color-subtle)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.25rem" }}>
        {label}
      </div>
      <div style={{ fontFamily: "var(--font-mono)", fontWeight: strong ? 800 : 700, color: strong ? "var(--color-accent)" : "var(--color-fg)" }}>
        {value === null ? "—" : isString ? value : value}
        {value !== null && suffix}
      </div>
    </div>
  );
}

function ExportCard({ title, dataset, description, jsonOnly }: { title: string; dataset: string; description: string; jsonOnly?: boolean }) {
  return (
    <div className="card" style={{ padding: "1.25rem" }}>
      <div style={{ fontWeight: 600, color: "var(--color-fg)", marginBottom: "0.5rem" }}>{title}</div>
      <p style={{ fontSize: "0.875rem", color: "var(--color-muted)", marginBottom: "1rem", lineHeight: 1.6 }}>
        {description}
      </p>
      <div className="flex gap-2">
        {!jsonOnly && <a className="btn-secondary" href={`/api/admin/export/${dataset}?format=csv`}>Download CSV</a>}
        <a className="btn-secondary" href={`/api/admin/export/${dataset}?format=json`}>Download JSON</a>
      </div>
    </div>
  );
}

function DeadlineChip({ status, label }: { status: DeadlineStatus; label: string }) {
  const color = !status.open
    ? "var(--color-border)"
    : status.daysRemaining !== null && status.daysRemaining <= 2
    ? "var(--color-warning)"
    : "var(--color-success)";
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.375rem",
        fontSize: "0.75rem",
        padding: "0.25rem 0.625rem",
        borderRadius: 999,
        border: `1px solid ${color}`,
        color: !status.open ? "var(--color-subtle)" : color,
        background: `color-mix(in srgb, ${color} 10%, transparent)`,
      }}
    >
      <span>{!status.open ? "🔒" : "✓"}</span>
      <span>{label}: {status.open ? (status.daysRemaining === null ? "open" : status.daysRemaining === 0 ? "closes today" : `${status.daysRemaining}d`) : "closed"}</span>
    </div>
  );
}

function AnalyticsTab({ data }: { data: AnalyticsData }) {
  const maxHarness = Math.max(...data.harnesses.map((h) => h.count), 1);
  const maxModel = Math.max(...data.models.map((m) => m.count), 1);
  const maxBudget = Math.max(...data.budgetTiers.map((b) => b.count), 1);

  return (
    <div className="flex flex-col gap-6">
      {/* Summary row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="With vibe.json" value={data.submissionsWithVibeJson} suffix={`/${data.totalSubmissions}`} color />
        <StatCard label="Avg Human Hours" value={data.avgHumanHours ?? "—"} isString={data.avgHumanHours === null} color />
        <StatCard label="Avg Agent Hours" value={data.avgAgentHours ?? "—"} isString={data.avgAgentHours === null} color />
        <StatCard label="Total Agent Hours" value={Math.round(data.totalAgentHours)} color />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Agent Harnesses */}
        <div>
          <h2 style={{ fontWeight: 600, color: "var(--color-fg)", marginBottom: "1rem", fontSize: "0.9375rem" }}>
            Agent Harnesses
          </h2>
          {data.harnesses.length === 0 ? (
            <div style={{ color: "var(--color-subtle)", fontSize: "0.875rem" }}>No data yet</div>
          ) : (
            <div className="flex flex-col gap-2">
              {data.harnesses.map((h) => (
                <div key={h.name} className="flex items-center gap-3">
                  <div style={{ width: "8rem", fontSize: "0.8125rem", color: "var(--color-fg)", flexShrink: 0 }}>
                    {h.name}
                  </div>
                  <div style={{ flex: 1, height: 6, background: "var(--color-surface-2)", borderRadius: 999, overflow: "hidden" }}>
                    <div style={{ width: `${(h.count / maxHarness) * 100}%`, height: "100%", background: "var(--color-accent)", borderRadius: 999, transition: "width 300ms" }} />
                  </div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--color-muted)", minWidth: "3rem", textAlign: "right" }}>
                    {h.count} ({h.pct}%)
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* AI Models */}
        <div>
          <h2 style={{ fontWeight: 600, color: "var(--color-fg)", marginBottom: "1rem", fontSize: "0.9375rem" }}>
            AI Models Used
          </h2>
          {data.models.length === 0 ? (
            <div style={{ color: "var(--color-subtle)", fontSize: "0.875rem" }}>No data yet</div>
          ) : (
            <div className="flex flex-col gap-2">
              {data.models.map((m) => (
                <div key={m.name} className="flex items-center gap-3">
                  <div style={{ width: "8rem", fontSize: "0.8125rem", color: "var(--color-fg)", flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {m.name}
                  </div>
                  <div style={{ flex: 1, height: 6, background: "var(--color-surface-2)", borderRadius: 999, overflow: "hidden" }}>
                    <div style={{ width: `${(m.count / maxModel) * 100}%`, height: "100%", background: "var(--color-accent)", borderRadius: 999, transition: "width 300ms" }} />
                  </div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--color-muted)", minWidth: "3rem", textAlign: "right" }}>
                    {m.count} ({m.pct}%)
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Budget Tiers */}
      <div>
        <h2 style={{ fontWeight: 600, color: "var(--color-fg)", marginBottom: "1rem", fontSize: "0.9375rem" }}>
          Budget Tiers
        </h2>
        {data.budgetTiers.length === 0 ? (
          <div style={{ color: "var(--color-subtle)", fontSize: "0.875rem" }}>No data yet</div>
        ) : (
          <div className="flex flex-col gap-2">
            {data.budgetTiers.map((b) => (
              <div key={b.tier} className="flex items-center gap-3">
                <div style={{ width: "10rem", fontSize: "0.8125rem", color: "var(--color-fg)", flexShrink: 0 }}>
                  {b.label}
                </div>
                <div style={{ flex: 1, height: 6, background: "var(--color-surface-2)", borderRadius: 999, overflow: "hidden" }}>
                  <div style={{ width: `${(b.count / maxBudget) * 100}%`, height: "100%", background: "var(--color-warning)", borderRadius: 999, transition: "width 300ms" }} />
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--color-muted)", minWidth: "3rem", textAlign: "right" }}>
                  {b.count} ({b.pct}%)
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Hours breakdown */}
      {(data.totalHumanHours > 0 || data.totalAgentHours > 0) && (
        <div>
          <h2 style={{ fontWeight: 600, color: "var(--color-fg)", marginBottom: "1rem", fontSize: "0.9375rem" }}>
            Human vs Agent Hours
          </h2>
          <div className="card" style={{ padding: "1.25rem" }}>
            <div className="flex flex-col gap-4">
              <HoursRow label="Human hours" total={data.totalHumanHours} avg={data.avgHumanHours} color="var(--color-fg)" />
              <HoursRow label="Agent hours" total={data.totalAgentHours} avg={data.avgAgentHours} color="var(--color-accent)" />
            </div>
            {data.totalHumanHours > 0 && data.totalAgentHours > 0 && (
              <div style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid var(--color-border)", fontSize: "0.875rem", color: "var(--color-muted)" }}>
                Agent amplification: <strong style={{ color: "var(--color-accent)" }}>
                  {(data.totalAgentHours / Math.max(data.totalHumanHours, 1)).toFixed(1)}×
                </strong>{" "}
                more agent hours per human hour
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function HoursRow({ label, total, avg, color }: { label: string; total: number; avg: number | null; color: string }) {
  return (
    <div className="flex items-center gap-4">
      <div style={{ width: "8rem", fontSize: "0.875rem", color: "var(--color-fg)", flexShrink: 0 }}>{label}</div>
      <div style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color, fontSize: "1.25rem", minWidth: "4rem" }}>
        {Math.round(total)}h
      </div>
      {avg !== null && (
        <div style={{ fontSize: "0.8125rem", color: "var(--color-subtle)" }}>avg {avg}h/team</div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  suffix,
  color,
  isString,
}: {
  label: string;
  value: number | string;
  suffix?: string;
  color?: boolean;
  isString?: boolean;
}) {
  return (
    <div className="card" style={{ padding: "1.25rem" }}>
      <div
        style={{
          fontSize: "0.6875rem",
          color: "var(--color-subtle)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          marginBottom: "0.5rem",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "var(--font-headline)",
          fontSize: "2rem",
          fontWeight: 700,
          color: color ? "var(--color-accent)" : "var(--color-fg)",
          lineHeight: 1,
        }}
      >
        {value}
        {suffix && <span style={{ fontSize: "1rem", color: "var(--color-muted)" }}>{suffix}</span>}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls: Record<string, string> = {
    draft: "badge-warning",
    submitted: "badge-2",
    finalized: "badge-success",
    locked: "badge-default",
  };
  return <span className={`badge ${cls[status] ?? "badge-default"}`}>{status}</span>;
}

// ── AI Reviews Tab ────────────────────────────────────────────────────────────

const PROVIDERS = [
  { value: "mock", label: "Mock (no API key needed)" },
  { value: "anthropic", label: "Anthropic" },
  { value: "openai", label: "OpenAI" },
  { value: "gemini", label: "Gemini (placeholder)" },
  { value: "local", label: "Local/Other (placeholder)" },
];

const DEFAULT_MODELS: Record<string, string> = {
  mock: "mock",
  anthropic: "claude-sonnet-4-6",
  openai: "gpt-4o",
  gemini: "gemini-1.5-pro",
  local: "llama3",
};

interface ImportForm {
  open: boolean;
  provider: string;
  modelName: string;
  json: string;
  error: string;
  submitting: boolean;
}

function download(content: string, filename: string, type = "application/json") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function AiReviewsTab({
  submissions,
  aiJudgeRuns,
  baseUrl,
  rosters,
  onViewTeam,
}: {
  submissions: SubmissionRow[];
  aiJudgeRuns: AiJudgeRunRow[];
  baseUrl: string;
  rosters: AdminTeamRosterRow[];
  onViewTeam: (roster: AdminTeamRosterRow | null) => void;
}) {
  const router = useRouter();
  const [provider, setProvider] = useState("mock");
  const [modelName, setModelName] = useState("mock");
  const [running, setRunning] = useState<Record<string, boolean>>({});
  const [copying, setCopying] = useState<Record<string, boolean>>({});
  const [curlCopying, setCurlCopying] = useState<Record<string, boolean>>({});
  const [downloading, setDownloading] = useState<Record<string, boolean>>({});
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchDownloading, setBatchDownloading] = useState<"packets" | "prompts" | null>(null);
  const [batchProgress, setBatchProgress] = useState(0);
  const [importForms, setImportForms] = useState<Record<string, ImportForm>>({});

  function onProviderChange(p: string) {
    setProvider(p);
    setModelName(DEFAULT_MODELS[p] ?? "");
  }

  async function runSingle(submissionId: string) {
    setRunning((r) => ({ ...r, [submissionId]: true }));
    await fetch("/api/admin/ai-runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ submissionId, modelProvider: provider, modelName }),
    });
    setRunning((r) => ({ ...r, [submissionId]: false }));
    router.refresh();
  }

  async function runBatch() {
    setBatchRunning(true);
    await fetch("/api/admin/ai-runs/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modelProvider: provider, modelName }),
    });
    setBatchRunning(false);
    router.refresh();
  }

  async function copyPrompt(submissionId: string) {
    setCopying((c) => ({ ...c, [submissionId]: true }));
    try {
      const res = await fetch(`/api/admin/ai-runs/prompt/${submissionId}`);
      if (res.ok) {
        const text = await res.text();
        await navigator.clipboard.writeText(text);
      }
    } finally {
      setCopying((c) => ({ ...c, [submissionId]: false }));
    }
  }

  async function copyCurl(submissionId: string) {
    setCurlCopying((c) => ({ ...c, [submissionId]: true }));
    try {
      const res = await fetch(`/api/admin/ai-runs/token/${submissionId}`, {
        method: "POST",
      });
      if (res.ok) {
        const { curlCommand } = await res.json() as { curlCommand: string };
        await navigator.clipboard.writeText(curlCommand);
      }
    } finally {
      setCurlCopying((c) => ({ ...c, [submissionId]: false }));
    }
  }

  async function downloadPacket(submissionId: string, title: string) {
    setDownloading((d) => ({ ...d, [submissionId]: true }));
    try {
      const res = await fetch(`/api/admin/ai-runs/packet/${submissionId}`);
      if (res.ok) {
        const text = await res.text();
        download(text, `agent-eval-${submissionId}.json`);
      }
    } finally {
      setDownloading((d) => ({ ...d, [submissionId]: false }));
    }
  }

  async function downloadAllPackets() {
    setBatchDownloading("packets");
    setBatchProgress(0);
    const lines: string[] = [];
    for (let i = 0; i < submissions.length; i++) {
      const sub = submissions[i];
      setBatchProgress(i + 1);
      const res = await fetch(`/api/admin/ai-runs/packet/${sub.id}`);
      if (res.ok) lines.push(await res.text());
    }
    download(lines.join("\n"), "agent-eval-all.jsonl");
    setBatchDownloading(null);
    setBatchProgress(0);
  }

  async function downloadAllPrompts() {
    setBatchDownloading("prompts");
    setBatchProgress(0);
    const parts: string[] = [];
    for (let i = 0; i < submissions.length; i++) {
      const sub = submissions[i];
      setBatchProgress(i + 1);
      const res = await fetch(`/api/admin/ai-runs/prompt/${sub.id}`);
      if (res.ok) {
        parts.push(`\n\n${"=".repeat(80)}\n# ${sub.projectTitle ?? sub.teamName} (${sub.id})\n${"=".repeat(80)}\n\n`);
        parts.push(await res.text());
      }
    }
    download(parts.join(""), "eval-prompts-all.md", "text/markdown");
    setBatchDownloading(null);
    setBatchProgress(0);
  }

  function openImport(submissionId: string) {
    setImportForms((f) => ({
      ...f,
      [submissionId]: { open: true, provider: "anthropic", modelName: "claude-sonnet-4-6", json: "", error: "", submitting: false },
    }));
  }

  function closeImport(submissionId: string) {
    setImportForms((f) => ({ ...f, [submissionId]: { ...f[submissionId], open: false } }));
  }

  function updateImport(submissionId: string, patch: Partial<ImportForm>) {
    setImportForms((f) => ({ ...f, [submissionId]: { ...f[submissionId], ...patch } }));
  }

  async function submitImport(submissionId: string) {
    const form = importForms[submissionId];
    if (!form) return;

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(form.json);
    } catch {
      updateImport(submissionId, { error: "Invalid JSON — check the pasted output." });
      return;
    }

    updateImport(submissionId, { submitting: true, error: "" });
    const res = await fetch("/api/admin/ai-runs/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        submission_id: submissionId,
        provider: form.provider,
        model_name: form.modelName,
        scores_json: parsed,
        rationale: (parsed.rationale as string) ?? undefined,
        risk_flags: Array.isArray(parsed.risk_flags) ? parsed.risk_flags : undefined,
        suggested_human_questions: Array.isArray(parsed.suggested_human_questions) ? parsed.suggested_human_questions : undefined,
      }),
    });

    if (res.ok) {
      updateImport(submissionId, { open: false, submitting: false, json: "" });
      router.refresh();
    } else {
      const err = await res.json() as { error?: string; details?: string[] };
      updateImport(submissionId, { error: err.error ?? "Import failed", submitting: false });
    }
  }

  const runsBySubmission = aiJudgeRuns.reduce<Record<string, AiJudgeRunRow[]>>((acc, r) => {
    (acc[r.submissionId] ??= []).push(r);
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-6">
      {/* Controls card */}
      <div className="card" style={{ padding: "1.25rem" }}>
        <div style={{ fontWeight: 600, color: "var(--color-fg)", marginBottom: "1rem", fontSize: "0.9375rem" }}>
          LLM Judge Controls
        </div>

        {/* Internal eval row */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end flex-wrap mb-4">
          <div>
            <label className="label" style={{ display: "block", marginBottom: "0.25rem" }}>Provider</label>
            <select
              value={provider}
              onChange={(e) => onProviderChange(e.target.value)}
              style={{ background: "var(--color-surface)", color: "var(--color-fg)", border: "1px solid var(--color-border)", borderRadius: 8, padding: "0.4rem 0.75rem", fontSize: "0.8125rem", minWidth: 200 }}
            >
              {PROVIDERS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" style={{ display: "block", marginBottom: "0.25rem" }}>Model name</label>
            <input
              className="input"
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              style={{ fontFamily: "var(--font-mono)", fontSize: "0.8125rem", minWidth: 180 }}
              placeholder="e.g. claude-sonnet-4-6"
            />
          </div>
          <button onClick={runBatch} disabled={batchRunning} className="btn-primary" style={{ whiteSpace: "nowrap" }}>
            {batchRunning ? "Running batch…" : `Run Batch (${submissions.length})`}
          </button>
        </div>

        {/* External eval batch tools */}
        <div className="flex gap-2 flex-wrap" style={{ paddingTop: "0.75rem", borderTop: "1px solid var(--color-border)" }}>
          <span style={{ fontSize: "0.75rem", color: "var(--color-subtle)", alignSelf: "center", marginRight: "0.25rem" }}>External eval:</span>
          <button
            onClick={downloadAllPackets}
            disabled={batchDownloading !== null}
            className="btn-secondary"
            style={{ fontSize: "0.75rem" }}
          >
            {batchDownloading === "packets" ? `Fetching ${batchProgress}/${submissions.length}…` : "⬇ Agent Eval JSON (JSONL)"}
          </button>
          <button
            onClick={downloadAllPrompts}
            disabled={batchDownloading !== null}
            className="btn-secondary"
            style={{ fontSize: "0.75rem" }}
          >
            {batchDownloading === "prompts" ? `Building ${batchProgress}/${submissions.length}…` : "⬇ Eval Prompts (MD)"}
          </button>
        </div>

        <div className="flex items-start gap-2 mt-3" style={{ fontSize: "0.75rem", color: "var(--color-subtle)" }}>
          <span style={{ color: "var(--color-warning)" }}>⚠</span>
          <span>LLM scores are experimental and do not affect official rankings unless explicitly enabled in event settings.</span>
        </div>
      </div>

      {/* Per-submission cards */}
      {submissions.map((sub) => {
        const runs = runsBySubmission[sub.id] ?? [];
        const isRunning = running[sub.id];
        const isCopying = copying[sub.id];
        const isCurlCopying = curlCopying[sub.id];
        const isDownloading = downloading[sub.id];
        const importForm = importForms[sub.id];

        return (
          <div key={sub.id} className="card" style={{ padding: "1.25rem" }}>
            {/* Header */}
            <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
              <div>
                <div style={{ fontWeight: 600, color: "var(--color-fg)", marginBottom: "0.2rem" }}>
                  {sub.projectTitle ?? sub.teamName}
                </div>
                <TeamNameWithRoster
                  teamName={sub.teamName}
                  roster={rosters.find((roster) => roster.submissionId === sub.id)}
                  onViewTeam={onViewTeam}
                />
              </div>
              <div className="flex gap-2 flex-wrap" style={{ flexShrink: 0 }}>
                <button onClick={() => runSingle(sub.id)} disabled={isRunning} className="btn-secondary" style={{ fontSize: "0.75rem" }}>
                  {isRunning ? "Running…" : "Run Eval"}
                </button>
                <button onClick={() => copyPrompt(sub.id)} disabled={isCopying} className="btn-secondary" style={{ fontSize: "0.75rem" }}>
                  {isCopying ? "📋 Copied!" : "📋 Eval Prompt"}
                </button>
                <button onClick={() => copyCurl(sub.id)} disabled={isCurlCopying} className="btn-secondary" style={{ fontSize: "0.75rem" }}>
                  {isCurlCopying ? "📋 Copied!" : "📋 Curl"}
                </button>
                <button onClick={() => downloadPacket(sub.id, sub.projectTitle ?? sub.teamName)} disabled={isDownloading} className="btn-secondary" style={{ fontSize: "0.75rem" }}>
                  {isDownloading ? "Fetching…" : "⬇ Agent Eval JSON"}
                </button>
                <button onClick={() => importForm?.open ? closeImport(sub.id) : openImport(sub.id)} className="btn-secondary" style={{ fontSize: "0.75rem" }}>
                  Import Result
                </button>
              </div>
            </div>
            <div className="flex items-start gap-1.5 mb-3" style={{ fontSize: "0.6875rem", color: "var(--color-subtle)" }}>
              <span style={{ color: "var(--color-warning)", flexShrink: 0 }}>⚠</span>
              <span>Evaluation tokens are submission-scoped — they can fetch and import AI judge data for this submission only.</span>
            </div>

            {/* Import panel */}
            {importForm?.open && (
              <div className="card" style={{ padding: "1rem", marginBottom: "0.75rem", background: "var(--color-surface-2)" }}>
                <div style={{ fontWeight: 600, color: "var(--color-fg)", fontSize: "0.875rem", marginBottom: "0.75rem" }}>
                  Import external LLM result
                </div>
                <div className="flex gap-2 mb-2 flex-wrap">
                  <input
                    className="input"
                    value={importForm.provider}
                    onChange={(e) => updateImport(sub.id, { provider: e.target.value })}
                    placeholder="Provider (e.g. anthropic)"
                    style={{ fontFamily: "var(--font-mono)", fontSize: "0.8125rem", flex: 1, minWidth: 120 }}
                  />
                  <input
                    className="input"
                    value={importForm.modelName}
                    onChange={(e) => updateImport(sub.id, { modelName: e.target.value })}
                    placeholder="Model (e.g. claude-opus-4-8)"
                    style={{ fontFamily: "var(--font-mono)", fontSize: "0.8125rem", flex: 1, minWidth: 150 }}
                  />
                </div>
                <textarea
                  value={importForm.json}
                  onChange={(e) => updateImport(sub.id, { json: e.target.value, error: "" })}
                  placeholder={`Paste the JSON output from the LLM:\n{\n  "overall_score": 78,\n  "product_sense_score": 75,\n  ...\n}`}
                  style={{
                    width: "100%",
                    minHeight: 140,
                    fontFamily: "var(--font-mono)",
                    fontSize: "0.75rem",
                    background: "var(--color-surface)",
                    color: "var(--color-fg)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 8,
                    padding: "0.5rem 0.75rem",
                    resize: "vertical",
                    boxSizing: "border-box",
                  }}
                />
                {importForm.error && (
                  <div style={{ fontSize: "0.8125rem", color: "var(--color-error)", marginTop: "0.5rem" }}>{importForm.error}</div>
                )}
                <div className="flex gap-2 mt-2">
                  <button onClick={() => submitImport(sub.id)} disabled={importForm.submitting || !importForm.json.trim()} className="btn-primary" style={{ fontSize: "0.8125rem" }}>
                    {importForm.submitting ? "Importing…" : "Import"}
                  </button>
                  <button onClick={() => closeImport(sub.id)} className="btn-ghost" style={{ fontSize: "0.8125rem" }}>Cancel</button>
                </div>
              </div>
            )}

            {/* Deterministic review */}
            <div className="flex items-center gap-2 flex-wrap" style={{ paddingBottom: "0.75rem", borderBottom: "1px solid var(--color-border)", marginBottom: "0.75rem" }}>
              <span style={{ fontSize: "0.75rem", color: "var(--color-subtle)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", minWidth: 110 }}>
                Deterministic
              </span>
              {sub.aiReviewStatus ? (
                <>
                  <span className={`badge ${sub.aiReviewStatus === "complete" ? "badge-success" : "badge-default"}`}>{sub.aiReviewStatus}</span>
                  {sub.aiGeneratedScore !== null && (
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.8125rem", color: "var(--color-accent)", fontWeight: 700 }}>
                      {sub.aiGeneratedScore}/100
                    </span>
                  )}
                  {sub.aiComplianceCheck && (
                    <span className={`badge ${sub.aiComplianceCheck === "pass" ? "badge-success" : sub.aiComplianceCheck === "partial" ? "badge-warning" : "badge-error"}`}>
                      {sub.aiComplianceCheck}
                    </span>
                  )}
                </>
              ) : (
                <span className="badge badge-default">no review yet — runs on finalize</span>
              )}
            </div>

            {/* LLM runs */}
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--color-subtle)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: runs.length > 1 ? "0.5rem" : 0 }}>
                LLM Evaluations ({runs.length})
              </div>
              {runs.length > 1 && (() => {
                const completeRuns = runs.filter((r) => r.status === "complete" && r.scoresJson);
                const consensusAvg = completeRuns.length
                  ? Math.round(completeRuns.reduce((s, r) => s + (((r.scoresJson as Record<string, number>)?.overall_score) ?? 0), 0) / completeRuns.length)
                  : null;
                return (
                  <div className="card" style={{ padding: "0.75rem 1rem", background: "var(--color-surface-2)", marginBottom: "0.5rem" }}>
                    <div className="flex items-center gap-3 mb-2">
                      <span style={{ fontSize: "0.75rem", color: "var(--color-subtle)", fontWeight: 600 }}>Consensus</span>
                      {consensusAvg !== null && (
                        <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--color-accent)", fontSize: "1rem" }}>{consensusAvg}/100</span>
                      )}
                      <span style={{ fontSize: "0.6875rem", color: "var(--color-subtle)" }}>{completeRuns.length} model{completeRuns.length !== 1 ? "s" : ""}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      {completeRuns.map((r) => {
                        const score = (r.scoresJson as Record<string, number>)?.overall_score ?? 0;
                        const label = `${r.modelProvider.replace("external/", "")}/${r.modelName}`;
                        return (
                          <div key={r.id} className="flex items-center gap-2">
                            <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.6875rem", color: "var(--color-muted)", minWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
                            <div style={{ flex: 1, height: 4, background: "var(--color-surface)", borderRadius: 999 }}>
                              <div style={{ width: `${score}%`, height: "100%", background: "var(--color-accent)", borderRadius: 999 }} />
                            </div>
                            <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.6875rem", color: "var(--color-fg)", fontWeight: 600, minWidth: 28, textAlign: "right" }}>{score}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
              {runs.length === 0 ? (
                <div style={{ fontSize: "0.8125rem", color: "var(--color-subtle)", marginTop: "0.5rem" }}>
                  None yet — run eval or import an external result above.
                </div>
              ) : (
                <div className="flex flex-col gap-2 mt-2">
                  {runs.map((run) => {
                    const scores = run.scoresJson as Record<string, number> | null;
                    const overall = scores?.overall_score ?? null;
                    const flags = Array.isArray((run.scoresJson as Record<string, unknown> | null)?.risk_flags)
                      ? (run.scoresJson as Record<string, unknown>).risk_flags as string[]
                      : [];
                    return (
                      <div key={run.id} className="card" style={{ padding: "0.875rem 1rem", background: "var(--color-surface-2)" }}>
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--color-accent)" }}>
                            {run.modelProvider}/{run.modelName}
                          </span>
                          <span className={`badge ${run.status === "complete" ? "badge-success" : run.status === "failed" ? "badge-error" : run.status === "running" ? "badge-warning" : "badge-default"}`}>
                            {run.status}
                          </span>
                          {overall !== null && (
                            <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--color-accent)", fontSize: "0.875rem" }}>{overall}/100</span>
                          )}
                          {run.createdAt && (
                            <span style={{ fontSize: "0.6875rem", color: "var(--color-subtle)", marginLeft: "auto" }}>
                              {run.createdAt.slice(0, 16).replace("T", " ")}
                            </span>
                          )}
                        </div>
                        {scores && (
                          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                            {(["product_sense_score", "originality_score", "execution_score", "ai_collaboration_score", "usefulness_score", "presentation_score"] as const).map((k) => (
                              <span key={k} style={{ fontSize: "0.6875rem", color: "var(--color-subtle)", fontFamily: "var(--font-mono)" }}>
                                {k.replace(/_score$/, "").replace(/_/g, " ")}: <strong style={{ color: "var(--color-fg)" }}>{scores[k]}</strong>
                              </span>
                            ))}
                          </div>
                        )}
                        {run.rationale && (
                          <p style={{ fontSize: "0.8125rem", color: "var(--color-muted)", marginTop: "0.5rem", lineHeight: 1.6 }}>{run.rationale}</p>
                        )}
                        {flags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {flags.map((f, i) => (
                              <span key={i} style={{ fontSize: "0.6875rem", color: "var(--color-warning)", border: "1px solid var(--color-warning)", borderRadius: 4, padding: "0.1rem 0.4rem", opacity: 0.8 }}>
                                ⚠ {f}
                              </span>
                            ))}
                          </div>
                        )}
                        {run.error && (
                          <div style={{ fontSize: "0.8125rem", color: "var(--color-error)", marginTop: "0.5rem" }}>Error: {run.error}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Demo Checklist Tab ─────────────────────────────────────────────────────────

function CheckItem({ ok, warn, label, detail }: { ok?: boolean; warn?: boolean; label: string; detail?: string }) {
  const icon = ok ? "✓" : warn ? "⚠" : "✗";
  const color = ok ? "var(--color-success)" : warn ? "var(--color-warning)" : "var(--color-error, #ef4444)";
  return (
    <div className="flex items-start gap-3" style={{ padding: "0.625rem 0" }}>
      <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color, minWidth: "1rem", flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <span style={{ fontWeight: 500, color: "var(--color-fg)", fontSize: "0.875rem" }}>{label}</span>
        {detail && <div style={{ fontSize: "0.75rem", color: "var(--color-muted)", marginTop: "0.125rem" }}>{detail}</div>}
      </div>
    </div>
  );
}

function CheckSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: "1.25rem" }}>
      <div style={{ fontWeight: 600, color: "var(--color-fg)", marginBottom: "0.75rem", fontSize: "0.9375rem", borderBottom: "1px solid var(--color-border)", paddingBottom: "0.5rem" }}>
        {title}
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {children}
      </div>
    </div>
  );
}

function DemoChecklistTab({ data }: { data: AdminPageData }) {
  const [seeding, setSeeding] = useState<string | null>(null);
  const [seedResult, setSeedResult] = useState<{ ok: boolean; message: string } | null>(null);

  const llmEvalCount = data.aiJudgeRuns.filter((r) => r.status === "complete").length;
  const totalPossibleScores = data.submissions.length * data.judges.length;
  const votingEnabled = data.activeEvent?.audienceVotingEnabled ?? false;
  const baseOk = data.baseUrlConfigured;
  const allDetReviewed = data.completedAiReviews === data.submissions.length;
  const scoresOk = data.completedScoresCount === totalPossibleScores && totalPossibleScores > 0;
  const winnersPublished = !!data.activeEvent?.winnersPublishedAt;

  async function handleSeed(mode: string) {
    const confirmMsg = `This will WIPE ALL DATA and re-seed with ${mode} data. Are you sure?`;
    if (!window.confirm(confirmMsg)) return;
    setSeeding(mode);
    setSeedResult(null);
    try {
      const res = await fetch("/api/admin/seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const json = await res.json();
      if (res.ok) {
        setSeedResult({ ok: true, message: `Seeded with ${mode} data. Reload to see updated counts.` });
      } else {
        setSeedResult({ ok: false, message: json.error ?? "Seed failed" });
      }
    } catch (e) {
      setSeedResult({ ok: false, message: String(e) });
    }
    setSeeding(null);
  }

  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      <CheckSection title="Event Setup">
        <CheckItem
          ok={!!data.activeEvent}
          label={data.activeEvent ? `Active event: ${data.activeEvent.displayName ?? data.activeEvent.name}` : "No active event"}
          detail={data.activeEvent?.id}
        />
        <CheckItem
          ok={baseOk}
          warn={!baseOk}
          label={baseOk ? `Base URL configured: ${data.baseUrl}` : "Base URL not configured — using localhost:3000"}
          detail={baseOk ? undefined : "Set VIBE_HACKATHON_BASE_URL in .env.local for correct curl/import URLs"}
        />
      </CheckSection>

      <CheckSection title="Submissions">
        <CheckItem
          ok={data.submissions.length > 0}
          label={`${data.submissions.length} submission${data.submissions.length !== 1 ? "s" : ""} total`}
        />
        <CheckItem
          ok={data.finalizedCount === data.submissions.length && data.submissions.length > 0}
          warn={data.finalizedCount > 0 && data.finalizedCount < data.submissions.length}
          label={`${data.finalizedCount} / ${data.submissions.length} finalized`}
          detail={data.finalizedCount < data.submissions.length ? "Unfinalized submissions may not appear in rankings" : undefined}
        />
        <CheckItem
          ok={!data.submissionDeadlineStatus.open}
          warn={data.submissionDeadlineStatus.open}
          label={`Submission window: ${data.submissionDeadlineStatus.open ? "OPEN" : "CLOSED"}`}
          detail={data.submissionDeadlineStatus.daysRemaining !== null ? `${data.submissionDeadlineStatus.daysRemaining} day(s) remaining` : undefined}
        />
      </CheckSection>

      <CheckSection title="Judging">
        <CheckItem
          ok={data.judges.length > 0}
          label={`${data.judges.length} judge${data.judges.length !== 1 ? "s" : ""} registered`}
        />
        <CheckItem
          ok={scoresOk}
          warn={data.completedScoresCount > 0 && !scoresOk}
          label={`Judge scores: ${data.completedScoresCount} / ${totalPossibleScores} completed`}
          detail={!scoresOk && totalPossibleScores > 0 ? "Some judge reviews are incomplete — rankings may be provisional" : undefined}
        />
        <CheckItem
          ok={!data.judgingDeadlineStatus.open}
          warn={data.judgingDeadlineStatus.open}
          label={`Judging window: ${data.judgingDeadlineStatus.open ? "OPEN" : "CLOSED"}`}
          detail={data.judgingDeadlineStatus.daysRemaining !== null ? `${data.judgingDeadlineStatus.daysRemaining} day(s) remaining` : undefined}
        />
      </CheckSection>

      <CheckSection title="AI Reviews">
        <CheckItem
          ok={allDetReviewed}
          warn={data.completedAiReviews > 0 && !allDetReviewed}
          label={`Deterministic reviews: ${data.completedAiReviews} / ${data.submissions.length} complete`}
          detail={!allDetReviewed ? "Missing deterministic reviews affect the official AI reproducibility score" : undefined}
        />
        <CheckItem
          ok={llmEvalCount > 0}
          warn={llmEvalCount === 0}
          label={`LLM evaluations: ${llmEvalCount} run${llmEvalCount !== 1 ? "s" : ""} imported`}
          detail="LLM evals are optional and do not affect official rankings"
        />
      </CheckSection>

      <CheckSection title="Audience Voting">
        <CheckItem
          ok={votingEnabled}
          warn={!votingEnabled}
          label={`Audience voting: ${votingEnabled ? "enabled" : "disabled"}`}
        />
        <CheckItem
          ok={data.totalVotes > 0}
          warn={data.totalVotes === 0}
          label={`${data.totalVotes} audience vote${data.totalVotes !== 1 ? "s" : ""} cast`}
        />
      </CheckSection>

      <CheckSection title="Results">
        <CheckItem
          ok={winnersPublished}
          warn={!winnersPublished}
          label={winnersPublished ? `Winners published: ${data.activeEvent!.winnersPublishedAt!.slice(0, 10)}` : "Winners not yet published"}
          detail={!winnersPublished ? "Publish from the Rankings tab when ready" : undefined}
        />
        <CheckItem ok label="Export available" detail="All datasets ready at /api/admin/export/*" />
        <CheckItem ok={baseOk} warn={!baseOk} label={`Health check: /api/health`} detail="Verify app, DB, and env status" />
      </CheckSection>

      {/* Demo reset */}
      <div className="card" style={{ padding: "1.25rem", borderColor: "var(--color-error, #ef4444)" }}>
        <div style={{ fontWeight: 600, color: "var(--color-fg)", marginBottom: "0.25rem" }}>Demo Reset</div>
        <div style={{ fontSize: "0.8125rem", color: "var(--color-muted)", marginBottom: "1rem" }}>
          Wipe the database and re-seed. Confirmation required. Irreversible.
        </div>
        {seedResult && (
          <div style={{ fontSize: "0.8125rem", color: seedResult.ok ? "var(--color-success)" : "var(--color-error, #ef4444)", marginBottom: "0.75rem", padding: "0.5rem 0.75rem", background: "var(--color-surface-2)", borderRadius: 6 }}>
            {seedResult.message}
          </div>
        )}
        <div className="flex gap-2 flex-wrap">
          {(["default", "sim", "mixed"] as const).map((mode) => (
            <button
              key={mode}
              className="btn-ghost"
              style={{ fontSize: "0.8125rem", color: "var(--color-error, #ef4444)", borderColor: "var(--color-error, #ef4444)", opacity: seeding ? 0.5 : 1 }}
              disabled={!!seeding}
              onClick={() => handleSeed(mode)}
            >
              {seeding === mode ? "Seeding…" : `Seed ${mode} data`}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function EventSettingsTab({ eventSettings, setEventSettings, routerRefresh }: { eventSettings: ActiveEventRow; setEventSettings: (event: ActiveEventRow) => void; routerRefresh: () => void }) {
  async function save() {
    await fetch("/api/admin/events", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(eventSettings) });
    routerRefresh();
  }
  const statusItems = [
    ["Submissions open", eventSettings.submissionDeadline ? new Date(eventSettings.submissionDeadline).getTime() > Date.now() : true],
    ["Judging open", eventSettings.judgingDeadline ? new Date(eventSettings.judgingDeadline).getTime() > Date.now() : true],
    ["Voting enabled", eventSettings.audienceVotingEnabled && eventSettings.audienceVotingMode !== "disabled"],
    ["Results visible", eventSettings.audienceResultsVisible],
    ["Winners published", Boolean(eventSettings.winnersPublishedAt)],
  ] as const;
  const inputStyle = { width: "100%", marginTop: "0.25rem", background: "var(--color-surface)", color: "var(--color-fg)", border: "1px solid var(--color-border)", borderRadius: 8, padding: "0.5rem" } as const;
  return (
    <div className="flex flex-col gap-5">
      <div className="card" style={{ padding: "1.25rem" }}>
        <h2 style={{ fontFamily: "var(--font-headline)", fontWeight: 800, color: "var(--color-fg)", fontSize: "1.35rem", marginBottom: "1rem" }}>Event Settings</h2>
        <div className="card" style={{ padding: "1rem", marginBottom: "1rem", background: "var(--color-surface-2)" }}>
          <div style={{ fontWeight: 850, color: "var(--color-fg)", marginBottom: "0.25rem" }}>
            {eventSettings.isFrozen ? "🏁 Event Frozen" : "🟢 Event Open"}
          </div>
          <div style={{ color: "var(--color-muted)", fontSize: "0.875rem", lineHeight: 1.55 }}>
            {eventSettings.isFrozen ? "Participant-facing workflows are locked. Admin dashboards, exports, rankings, and winner publishing remain available." : "Participant workflows are open subject to deadlines and visibility settings."}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-6 gap-2">{statusItems.map(([label, ok]) => <div key={label} className="badge" style={{ justifyContent: "center", border: `1px solid ${ok ? "var(--color-success)" : "var(--color-warning)"}`, color: ok ? "var(--color-success)" : "var(--color-warning)" }}>{ok ? "✓" : "⚠"} {label}</div>)}</div>
      </div>
      <div className="card" style={{ padding: "1.25rem" }}>
        <h3 style={{ fontWeight: 700, color: "var(--color-fg)", marginBottom: "1rem" }}>Branding</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label style={{ color: "var(--color-muted)", fontSize: "0.8125rem" }}>Display name<input style={inputStyle} value={eventSettings.displayName ?? ""} onChange={(e) => setEventSettings({ ...eventSettings, displayName: e.target.value })} /></label>
          <label style={{ color: "var(--color-muted)", fontSize: "0.8125rem" }}>Logo URL<input style={inputStyle} value={eventSettings.logoUrl ?? ""} onChange={(e) => setEventSettings({ ...eventSettings, logoUrl: e.target.value })} /></label>
          <label style={{ color: "var(--color-muted)", fontSize: "0.8125rem" }}>Tagline<input style={inputStyle} value={eventSettings.tagline ?? ""} onChange={(e) => setEventSettings({ ...eventSettings, tagline: e.target.value })} /></label>
          <label style={{ color: "var(--color-muted)", fontSize: "0.8125rem" }}>External URL<input style={inputStyle} value={eventSettings.externalUrl ?? ""} onChange={(e) => setEventSettings({ ...eventSettings, externalUrl: e.target.value })} /></label>
        </div>
      </div>
      <div className="card" style={{ padding: "1.25rem" }}>
        <h3 style={{ fontWeight: 700, color: "var(--color-fg)", marginBottom: "1rem" }}>Dates and visibility</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label style={{ color: "var(--color-muted)", fontSize: "0.8125rem" }}>Submission deadline<input type="datetime-local" style={inputStyle} value={eventSettings.submissionDeadline?.slice(0, 16) ?? ""} onChange={(e) => setEventSettings({ ...eventSettings, submissionDeadline: e.target.value || null })} /></label>
          <label style={{ color: "var(--color-muted)", fontSize: "0.8125rem" }}>Judging deadline<input type="datetime-local" style={inputStyle} value={eventSettings.judgingDeadline?.slice(0, 16) ?? ""} onChange={(e) => setEventSettings({ ...eventSettings, judgingDeadline: e.target.value || null })} /></label>
          {([
            ["isFrozen", "Event frozen"],
            ["audienceVotingEnabled", "Audience voting enabled"],
            ["audienceResultsVisible", "Audience results visible"],
            ["showJudgeChoice", "Show Judge Choice award"],
            ["showPeoplesChoice", "Show People's Choice award"],
            ["showAIChoice", "Show AI Choice award"],
            ["showSpecialAwards", "Show special awards"],
          ] as const).map(([key, label]) => <label key={key} style={{ color: "var(--color-fg)", fontSize: "0.875rem", display: "flex", alignItems: "center", gap: "0.5rem" }}><input type="checkbox" checked={Boolean(eventSettings[key as keyof ActiveEventRow])} onChange={(e) => setEventSettings({ ...eventSettings, [key]: e.target.checked })} /> {label}</label>)}
        </div>
        <p style={{ color: "var(--color-muted)", fontSize: "0.8125rem", marginTop: "0.75rem", lineHeight: 1.55 }}>
          Event Frozen locks new registrations, edits, finalization, team updates, voting, judging edits, and AI evaluation imports/runs until the event is unfrozen.
        </p>
      </div>
      <div className="card" style={{ padding: "1.25rem" }}>
        <h3 style={{ fontWeight: 700, color: "var(--color-fg)", marginBottom: "1rem" }}>Voting</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label style={{ color: "var(--color-muted)", fontSize: "0.8125rem" }}>Mode<select style={inputStyle} value={eventSettings.audienceVotingMode} onChange={(e) => setEventSettings({ ...eventSettings, audienceVotingMode: e.target.value })}><option value="disabled">Disabled</option><option value="human">Human</option></select></label>
          <label style={{ color: "var(--color-muted)", fontSize: "0.8125rem" }}>Identity<select style={inputStyle} value={eventSettings.audienceIdentityMethod} onChange={(e) => setEventSettings({ ...eventSettings, audienceIdentityMethod: e.target.value })}><option value="anonymous">Anonymous</option><option value="badge">Badge</option><option value="email">Email</option><option value="invite_code">Invite code</option></select></label>
          <label style={{ color: "var(--color-muted)", fontSize: "0.8125rem" }}>Award count<select style={inputStyle} value={eventSettings.audienceAwardCount} onChange={(e) => setEventSettings({ ...eventSettings, audienceAwardCount: Number(e.target.value) })}><option value={1}>Top 1</option><option value={2}>Top 2</option><option value={3}>Top 3</option></select></label>
        </div>
      </div>
      <button className="btn-primary" onClick={save} style={{ alignSelf: "flex-start" }}>Save Event Settings</button>
    </div>
  );
}

function ReleaseChecklistTab({ data }: { data: AdminPageData }) {
  const rows = [
    ["Core Experience", [["Home", true], ["Projects", data.submissions.length > 0], ["Submit", true], ["AI Evals", data.completedAiReviews > 0 || data.aiJudgeRuns.length > 0], ["Winners", true], ["Presentation mode", data.presentationEligibility.some((row) => row.eligible)]]],
    ["Operations", [["Health endpoint", true], ["Demo checklist", true], ["Event settings", Boolean(data.activeEvent)], ["Presentation debug", true], ["Export bundle", true]]],
    ["Competition", [["Judges", data.judges.length > 0], ["Audience voting", data.totalVotes >= 0], ["AI evaluations", data.completedAiReviews > 0 || data.aiJudgeRuns.length > 0]]],
    ["Data", [["Rankings", data.rankings.length > 0], ["Winners", Boolean(data.activeEvent?.winnersPublishedAt)], ["Exports", true]]],
    ["Documentation", [["README", true], ["AGENTS", true], ["HANDOFF", true]]],
  ] as const;
  return <div className="flex flex-col gap-5"><div className="grid grid-cols-2 sm:grid-cols-4 gap-3"><StatCard label="Projects" value={data.submissions.length} /><StatCard label="Judges" value={data.judges.length} /><StatCard label="Votes" value={data.totalVotes} /><StatCard label="AI Runs" value={data.aiJudgeRuns.length} color /></div>{rows.map(([section, items]) => <div key={section} className="card" style={{ padding: "1.25rem" }}><h2 style={{ fontWeight: 800, color: "var(--color-fg)", marginBottom: "1rem" }}>{section}</h2><div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{items.map(([label, ok]) => <div key={label} style={{ color: ok ? "var(--color-success)" : "var(--color-warning)", fontWeight: 700 }}>{ok ? "✓" : "⚠"} {label}</div>)}</div></div>)}</div>;
}

function PresentationOpsTab({ data }: { data: AdminPageData }) {
  const eligible = data.presentationEligibility.filter((row) => row.eligible);
  const inProgress = eligible.filter((row) => row.isInProgress);
  const excluded = data.presentationEligibility.filter((row) => !row.eligible);
  const dotCount = new Set(eligible.flatMap((row) => row.institutions)).size;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Eligible" value={eligible.length} color />
        <StatCard label="In Progress" value={inProgress.length} />
        <StatCard label="Visible Dots" value={dotCount} color />
        <StatCard label="Excluded" value={excluded.length} />
      </div>

      <div className="card" style={{ padding: "1.25rem" }}>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 style={{ color: "var(--color-fg)", fontWeight: 850, fontSize: "1.15rem", marginBottom: "0.35rem" }}>
              Presentation Mode
            </h2>
            <p style={{ color: "var(--color-muted)", fontSize: "0.875rem", lineHeight: 1.6 }}>
              Public projector view using eligible teams, public-safe roster data, and visible institution-dot rotation.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Link href="/presentation" target="_blank" className="btn-primary">Open Presentation ↗</Link>
            <Link href="/presentation?debugPresentation=1" target="_blank" className="btn-secondary">Debug View ↗</Link>
            <Link href="/api/v1/presentation/live" target="_blank" className="btn-ghost">JSON ↗</Link>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: "1rem", overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 980 }}>
          <thead>
            <tr style={{ background: "var(--color-surface-2)", color: "var(--color-subtle)", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              {["Project", "Status", "Eligibility", "Signals", "Institutions", "Reason"].map((heading) => (
                <th key={heading} style={{ textAlign: "left", padding: "0.7rem", borderBottom: "1px solid var(--color-border)", whiteSpace: "nowrap" }}>{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.presentationEligibility.map((row) => (
              <tr key={row.submissionId} style={{ borderBottom: "1px solid var(--color-border)" }}>
                <td style={{ padding: "0.75rem", color: "var(--color-fg)", fontWeight: 750 }}>
                  <div>{row.projectTitle ?? row.teamName}</div>
                  <div style={{ color: "var(--color-muted)", fontSize: "0.75rem" }}>{row.teamName}</div>
                </td>
                <td style={{ padding: "0.75rem", whiteSpace: "nowrap" }}>
                  <span className={`badge ${row.isInProgress ? "badge-warning" : "badge-success"}`}>{row.isInProgress ? "IN PROGRESS" : row.status}</span>
                </td>
                <td style={{ padding: "0.75rem", whiteSpace: "nowrap" }}>
                  <span className={`badge ${row.eligible ? "badge-success" : "badge-warning"}`}>{row.eligible ? "Included" : "Excluded"}</span>
                </td>
                <td style={{ padding: "0.75rem", color: "var(--color-muted)" }}>
                  <div style={{ fontFamily: "var(--font-mono)", color: "var(--color-fg)", fontWeight: 800 }}>{row.contentSignalCount}/2</div>
                  <div className="flex flex-wrap gap-1" style={{ marginTop: "0.35rem" }}>
                    {row.contentSignals.slice(0, 4).map((signal) => <span key={signal} className="badge badge-default">{signal}</span>)}
                    {row.contentSignals.length > 4 && <span className="badge badge-default">+{row.contentSignals.length - 4}</span>}
                  </div>
                </td>
                <td style={{ padding: "0.75rem", color: "var(--color-muted)" }}>
                  <div style={{ fontFamily: "var(--font-mono)", color: "var(--color-fg)", fontWeight: 800 }}>{row.geocodedInstitutionCount}</div>
                  <div style={{ fontSize: "0.75rem", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={row.institutions.join(", ")}>
                    {row.institutions.length ? row.institutions.join(", ") : "—"}
                  </div>
                </td>
                <td style={{ padding: "0.75rem", color: "var(--color-muted)", fontSize: "0.8125rem", maxWidth: 280 }}>
                  {row.eligible ? "Ready for presentation rotation" : row.missingReasons.join("; ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
