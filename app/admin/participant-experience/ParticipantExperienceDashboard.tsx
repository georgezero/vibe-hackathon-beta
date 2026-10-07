"use client";

import { useState } from "react";
import type { getParticipantExperienceData } from "@/lib/participant-experience";

type ExperienceData = Awaited<ReturnType<typeof getParticipantExperienceData>>;
type FeedbackRow = ExperienceData["feedback"][number];
type WindowKey = ExperienceData["window"];

const windows: Array<{ key: WindowKey; label: string }> = [
  { key: "today", label: "Today" },
  { key: "last_24_hours", label: "Last 24 hours" },
  { key: "last_7_days", label: "Last 7 days" },
  { key: "event_to_date", label: "Event to date" },
];

function formatDuration(value: number | null) {
  if (value === null) return "—";
  if (value < 1000) return `${value} ms`;
  return `${(value / 1000).toFixed(value >= 10_000 ? 0 : 1)} s`;
}

export default function ParticipantExperienceDashboard({ initialData }: { initialData: ExperienceData }) {
  const [feedback, setFeedback] = useState(initialData.feedback);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [pendingFeedbackId, setPendingFeedbackId] = useState<string | null>(null);

  async function updateFeedback(row: FeedbackRow, status: string) {
    setFeedbackError(null);
    setPendingFeedbackId(row.id);
    const response = await fetch(`/api/admin/participant-experience/feedback/${encodeURIComponent(row.id)}`, {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    }).catch(() => null);
    setPendingFeedbackId(null);
    if (!response?.ok) { setFeedbackError("The feedback state could not be updated."); return; }
    setFeedback((current: FeedbackRow[]) => current.map((item: FeedbackRow) => item.id === row.id ? { ...item, status: status as FeedbackRow["status"], reviewedAt: status === "new" ? null : new Date().toISOString() } : item));
  }

  return <div className="participant-experience-dashboard">
    <div className="participant-experience-window-bar" aria-label="Observation window">
      <span>Window</span>
      {windows.map((item) => <a key={item.key} href={`/admin/participant-experience?window=${item.key}`} className={initialData.window === item.key ? "is-active" : ""}>{item.label}</a>)}
    </div>
    {initialData.overview.participantsWithActivity === 0 && initialData.overview.projectsStarted === 0 && <div className="participant-experience-observation-note" role="status"><strong>No participant journey activity in this window yet.</strong><p>Observation begins as participants use the product. Zero activity is not evidence that a feature is unused or unwanted.</p></div>}

    <section className="participant-experience-section participant-experience-overview" aria-labelledby="experience-overview-title">
      <div className="participant-experience-section-heading"><div><h2 id="experience-overview-title">Experience overview</h2><p>Bounded signals for this event. The counts describe product movement, not participant performance.</p></div><span className="participant-experience-range">{new Date(initialData.windowStart).toLocaleDateString()}–{new Date(initialData.windowEnd).toLocaleDateString()}</span></div>
      <div className="participant-experience-metrics">
        <Metric label="Participants with activity" value={initialData.overview.participantsWithActivity} />
        <Metric label="Projects started" value={initialData.overview.projectsStarted} />
        <Metric label="Active projects" value={initialData.overview.activeProjects} />
        <Metric label="Finalized" value={initialData.overview.finalizedSubmissions} detail={initialData.overview.finalizationRate === null ? "No denominator yet" : `${initialData.overview.finalizationRate}% of started projects`} />
        <Metric label="Invitations accepted" value={initialData.overview.invitationsAccepted} />
        <Metric label="Agent workflow" value={initialData.overview.agentParticipants} detail="participants" />
      </div>
      <div className="participant-experience-mini-facts"><span>Community · {initialData.overview.communityParticipants}</span><span>Messages · {initialData.overview.messageParticipants}</span><span>Team Chat · {initialData.overview.teamChatParticipants}</span></div>
    </section>

    <section className="participant-experience-section" aria-labelledby="experience-funnel-title">
      <div className="participant-experience-section-heading"><div><h2 id="experience-funnel-title">Journey progression</h2><p>{initialData.definitions.funnelDenominator} A participant can revisit steps or take a different path.</p></div></div>
      <div className="participant-experience-funnel" role="list">
        {initialData.funnel.map((stage) => <div className="participant-experience-funnel-row" role="listitem" key={stage.key}><div><strong>{stage.label}</strong><span>{stage.count} signals · {stage.participants} participants</span></div><strong>{stage.conversion === null ? "—" : `${stage.conversion}%`}</strong></div>)}
      </div>
      <div className="participant-experience-timing"><span>Editor median / P90: {formatDuration(initialData.timing.editor.medianMs)} / {formatDuration(initialData.timing.editor.p90Ms)}</span><span>Preview median / P90: {formatDuration(initialData.timing.preview.medianMs)} / {formatDuration(initialData.timing.preview.p90Ms)}</span><span>Finalize median / P90: {formatDuration(initialData.timing.finalization.medianMs)} / {formatDuration(initialData.timing.finalization.p90Ms)}</span></div>
    </section>

    <div className="participant-experience-two-column">
      <section className="participant-experience-section" aria-labelledby="experience-friction-title"><div className="participant-experience-section-heading"><div><h2 id="experience-friction-title">Friction signals</h2><p>Guardrails are not automatically defects. Use frequency and feedback together.</p></div></div>{initialData.friction.length === 0 ? <p className="participant-experience-empty">No bounded failures recorded in this window. This does not mean no one encountered a problem.</p> : <ul className="participant-experience-list">{initialData.friction.map((item) => <li key={item.reason}><span>{item.label}</span><strong>{item.count}</strong></li>)}</ul>}</section>
      <section className="participant-experience-section" aria-labelledby="experience-adoption-title"><div className="participant-experience-section-heading"><div><h2 id="experience-adoption-title">Feature adoption</h2><p>Meaningful transitions only; no message or project content is collected.</p></div></div><ul className="participant-experience-list">{initialData.adoption.map((item) => <li key={item.key}><span>{item.label}</span><strong>{item.participants} people <small>· {item.count} signals</small></strong></li>)}</ul></section>
    </div>

    <div className="participant-experience-two-column">
      <section className="participant-experience-section" aria-labelledby="experience-navigation-title"><div className="participant-experience-section-heading"><div><h2 id="experience-navigation-title">Navigation destinations</h2><p>Fixed destination names make H.1 observation readable without recording URLs.</p></div></div>{initialData.navigation.length === 0 ? <p className="participant-experience-empty">No navigation destination signals yet.</p> : <ul className="participant-experience-list">{initialData.navigation.map((item) => <li key={item.destination}><span>{item.destination.replaceAll("_", " ")}</span><strong>{item.count}</strong></li>)}</ul>}<div className="participant-experience-device-list">{initialData.devices.map((item) => <span key={item.device}>{item.device} · {item.participants}</span>)}</div></section>
      <section className="participant-experience-section" aria-labelledby="experience-feedback-title"><div className="participant-experience-section-heading"><div><h2 id="experience-feedback-title">Participant feedback</h2><p>Optional notes shared with event organizers. Review state is intentionally small.</p></div></div>{feedback.length === 0 ? <p className="participant-experience-empty">No participant feedback in this window. Feedback is optional and an empty inbox does not mean no one had a problem.</p> : <div className="participant-experience-feedback-list">{feedback.map((row: FeedbackRow) => <article key={row.id} className="participant-experience-feedback-item"><div className="participant-experience-feedback-meta"><strong>{row.category.replaceAll("_", " ")}</strong><span>{row.context.replaceAll("_", " ")} · {new Date(row.createdAt).toLocaleString()}</span></div><p>{row.message}</p><div className="participant-experience-feedback-actions"><select aria-label={`Feedback state for ${row.id}`} value={row.status} disabled={pendingFeedbackId === row.id} onChange={(event) => { void updateFeedback(row, event.target.value); }}><option value="new">New</option><option value="reviewed">Reviewed</option><option value="resolved">Resolved</option><option value="dismissed">Dismissed</option></select></div></article>)}</div>}{feedbackError && <p className="participant-experience-error" role="alert">{feedbackError}</p>}</section>
    </div>
    <p className="participant-experience-footnote">{initialData.definitions.note} Telemetry is event-scoped and retained for a bounded observation window; authoritative submissions, memberships, messages, and audit history remain separate.</p>
  </div>;
}

function Metric({ label, value, detail }: { label: string; value: number; detail?: string }) {
  return <div className="participant-experience-metric"><span>{label}</span><strong>{value}</strong>{detail && <small>{detail}</small>}</div>;
}
