import Link from "next/link";
import type { PrizeEligibilitySummary } from "@/lib/prize-eligibility";

export function TeamSummaryCard({ token, summary, compact = false }: { token: string; summary: PrizeEligibilitySummary; compact?: boolean }) {
  return (
    <div className="card" style={{ padding: compact ? "1rem" : "1.25rem" }}>
      <div className="flex items-start justify-between gap-3 flex-wrap" style={{ marginBottom: "1rem" }}>
        <div>
          <h2 style={{ color: "var(--color-fg)", fontWeight: 850, fontSize: compact ? "1rem" : "1.2rem", marginBottom: "0.25rem" }}>Team eligibility</h2>
          <p style={{ color: "var(--color-muted)", fontSize: "0.8125rem", lineHeight: 1.5 }}>
            Your team must be registered event attendees to be eligible for prizes.
          </p>
        </div>
        <Link href={`/submit/${token}/team`} className="btn-secondary">Edit team →</Link>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <Metric label="Team size" value={`${summary.memberCount} / 6`} />
        <Metric label="Badge details" value={`${summary.badgeCount} / ${summary.memberCount}`} />
        <Metric label="Prize eligibility" value={summary.eligibleForPrize ? "Eligible" : "Needs details"} tone={summary.eligibleForPrize ? "success" : "warning"} />
        <Metric label="Students / trainees" value={String(summary.studentTraineeCount)} />
      </div>
      {summary.missingMembers.length > 0 && (
        <p style={{ color: "var(--color-warning)", fontSize: "0.75rem", lineHeight: 1.5, marginTop: "0.875rem" }}>
          Still needed: badge number for {summary.missingMembers.join(", ")}.
        </p>
      )}
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "success" | "warning" }) {
  const color = tone === "success" ? "var(--color-success)" : tone === "warning" ? "var(--color-warning)" : "var(--color-fg)";
  return (
    <div style={{ border: "1px solid var(--color-border)", background: "var(--color-surface-2)", borderRadius: 10, padding: "0.75rem" }}>
      <div style={{ color: "var(--color-subtle)", fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.25rem" }}>{label}</div>
      <div style={{ color, fontWeight: 850, fontSize: "0.95rem" }}>{value}</div>
    </div>
  );
}
