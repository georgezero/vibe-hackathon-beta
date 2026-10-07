import type { AwardBadge } from "@/lib/award-badges";

interface Props {
  badges?: AwardBadge[];
  prominence?: "compact" | "prominent";
}

const TONES: Record<AwardBadge["tone"], { fg: string; bg: string; border: string }> = {
  gold: {
    fg: "var(--color-warning)",
    bg: "color-mix(in srgb, var(--color-warning) 16%, transparent)",
    border: "color-mix(in srgb, var(--color-warning) 42%, transparent)",
  },
  orange: {
    fg: "var(--color-accent)",
    bg: "color-mix(in srgb, var(--color-accent) 15%, transparent)",
    border: "color-mix(in srgb, var(--color-accent) 38%, transparent)",
  },
  purple: {
    fg: "color-mix(in srgb, var(--color-accent-2) 60%, var(--color-accent))",
    bg: "color-mix(in srgb, var(--color-accent-2) 14%, transparent)",
    border: "color-mix(in srgb, var(--color-accent-2) 38%, transparent)",
  },
  teal: {
    fg: "color-mix(in srgb, var(--color-success) 72%, var(--color-accent-2))",
    bg: "color-mix(in srgb, var(--color-success) 13%, transparent)",
    border: "color-mix(in srgb, var(--color-success) 35%, transparent)",
  },
  blue: {
    fg: "var(--color-accent-2)",
    bg: "color-mix(in srgb, var(--color-accent-2) 13%, transparent)",
    border: "color-mix(in srgb, var(--color-accent-2) 35%, transparent)",
  },
};

export function AwardBadges({ badges = [], prominence = "compact" }: Props) {
  if (badges.length === 0) return null;
  const prominent = prominence === "prominent";
  return (
    <div className="flex flex-wrap gap-2" aria-label="Project awards">
      {badges.map((badge) => {
        const tone = TONES[badge.tone];
        return (
          <span
            key={badge.type}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: prominent ? "0.4rem" : "0.25rem",
              borderRadius: 999,
              border: `1px solid ${tone.border}`,
              background: tone.bg,
              color: tone.fg,
              fontSize: prominent ? "0.8125rem" : "0.6875rem",
              fontWeight: 800,
              lineHeight: 1,
              padding: prominent ? "0.42rem 0.75rem" : "0.28rem 0.55rem",
              whiteSpace: "nowrap",
            }}
          >
            <span aria-hidden>{badge.icon}</span>
            {badge.label}
          </span>
        );
      })}
    </div>
  );
}
