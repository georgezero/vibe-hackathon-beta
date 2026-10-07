export const dynamic = "force-dynamic";

import { NavPublic } from "@/components/NavPublic";
import { EventFreezeBanner } from "@/components/EventFreezeBanner";
import { getActiveEvent } from "@/lib/events";
import { getEventBranding } from "@/lib/event-branding";
import { deriveEventStage, deriveCountdownTarget, getStatusPageData, type EventStage } from "@/lib/event-status";
import { getEventHostLocation } from "@/lib/institution-geo";
import { StatusCountdown } from "./StatusCountdown";
import { StatusLiveClient, type ClientStatusData } from "./StatusLiveClient";

// ── Stage badge colors ────────────────────────────────────────────────────────

function stageStyle(colorClass: EventStage["colorClass"]) {
  const map = {
    success: { bg: "color-mix(in srgb, var(--color-success) 12%, var(--color-surface))", fg: "var(--color-success)" },
    warning: { bg: "color-mix(in srgb, var(--color-warning) 12%, var(--color-surface))", fg: "var(--color-warning)" },
    "accent-2": { bg: "color-mix(in srgb, var(--color-accent-2) 12%, var(--color-surface))", fg: "var(--color-accent-2)" },
    muted: { bg: "color-mix(in srgb, var(--color-muted) 10%, var(--color-surface))", fg: "var(--color-muted)" },
  } as const;
  return map[colorClass];
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function StatusPage() {
  const [event, branding] = await Promise.all([getActiveEvent(), getEventBranding()]);
  const countdown = deriveCountdownTarget(event);
  const hub = getEventHostLocation();
  const data = await getStatusPageData(event);
  const stage = deriveEventStage(event, data.winnersPublished ? "published" : null);

  // Convert Date objects to ISO strings for the client component
  const clientData: ClientStatusData = {
    stage,
    metrics: data.metrics,
    institutions: data.institutions,
    maxInstitutionTeams: data.maxInstitutionTeams,
    audienceLeaderboard: data.audienceLeaderboard,
    aiLeaderboard: data.aiLeaderboard,
    officialLeaderboard: data.officialLeaderboard,
    breakdown: data.breakdown,
    recentActivity: data.recentActivity.map((a) => ({
      key: a.key,
      icon: a.icon,
      label: a.label,
      detail: a.detail,
      timestamp: a.timestamp.toISOString(),
    })),
    votingOpen: data.votingOpen,
    resultsVisible: data.resultsVisible,
    submissionsOpen: data.submissionsOpen,
    winnersPublished: data.winnersPublished,
    updatedAt: data.updatedAt.toISOString(),
  };

  const { bg, fg } = stageStyle(stage.colorClass);

  return (
    <div className="flex flex-col min-h-screen">
      <style>{`
        @keyframes status-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.35; transform: scale(0.85); }
        }
      `}</style>

      <NavPublic />
      <EventFreezeBanner />

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section style={{
        background: "linear-gradient(160deg, var(--color-surface) 0%, var(--color-surface-2) 100%)",
        borderBottom: "1px solid var(--color-border)",
        padding: "2.5rem 1.5rem 2rem",
      }}>
        <div className="mx-auto max-w-7xl">
          {/* Logo or fallback title */}
          <div style={{ marginBottom: "1.25rem" }}>
            {branding.logoUrl ? (
              <img
                src={branding.logoUrl}
                alt={branding.eventName}
                style={{ height: 144, maxWidth: 360, objectFit: "contain", display: "block" }}
              />
            ) : (
              <h1 style={{
                fontFamily: "var(--font-headline)",
                fontSize: "clamp(1.25rem, 3vw, 2.25rem)",
                fontWeight: 900,
                letterSpacing: "-0.04em",
                color: "var(--color-fg)",
                lineHeight: 1,
              }}>
                Event Status
              </h1>
            )}
          </div>

          {/* Stage badge + countdown */}
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
            <span style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              background: bg,
              color: fg,
              border: `1px solid ${fg}`,
              borderRadius: 999,
              padding: "0.45rem 1.1rem",
              fontSize: "0.9375rem",
              fontWeight: 700,
              letterSpacing: "-0.01em",
            }}>
              {stage.pulse && (
                <span style={{
                  width: 8, height: 8, borderRadius: "50%",
                  background: fg,
                  display: "inline-block",
                  flexShrink: 0,
                  animation: "status-pulse 2s ease-in-out infinite",
                }} />
              )}
              {stage.label}
            </span>

            {countdown && (
              <StatusCountdown targetMs={countdown.targetMs} label={countdown.label} />
            )}
          </div>

          {/* Tagline */}
          {branding.tagline && (
            <p style={{ color: "var(--color-muted)", fontSize: "1rem", marginTop: "1rem", lineHeight: 1.5 }}>
              {branding.tagline}
            </p>
          )}
        </div>
      </section>

      {/* ── Dynamic content (polls for live updates) ────────────────────────── */}
      <main className="mx-auto max-w-7xl w-full px-4 sm:px-6 py-10 flex-1">
        <StatusLiveClient initialData={clientData} hub={hub} />
      </main>
    </div>
  );
}
