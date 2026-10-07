import type { PublicTeamMember } from "@/lib/team-display";

interface Props {
  teamName: string;
  members: PublicTeamMember[];
  leadInstitution?: string | null;
}

export function PublicTeamSpotlightCard({ teamName, members, leadInstitution }: Props) {
  const institutions = Array.from(new Set(members.map((member) => member.affiliation).filter(Boolean))) as string[];
  return (
    <section
      style={{
        border: "1px solid rgba(255,255,255,0.14)",
        background: "linear-gradient(145deg, rgba(10,16,28,0.88), rgba(8,12,22,0.72))",
        boxShadow: "0 28px 90px rgba(0,0,0,0.38)",
        borderRadius: 28,
        padding: "clamp(1rem, 2vw, 1.7rem)",
        backdropFilter: "blur(18px)",
        minHeight: 0,
      }}
      aria-label="Team spotlight"
    >
      <div style={{ marginBottom: "1rem" }}>
        <div style={{ color: "var(--color-accent)", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.16em", fontWeight: 900 }}>
          Team
        </div>
        <h2 style={{ color: "var(--color-fg)", fontFamily: "var(--font-headline)", fontSize: "clamp(1.45rem, 3vw, 2.4rem)", fontWeight: 950, letterSpacing: "-0.05em", lineHeight: 1.02, marginTop: "0.25rem" }}>
          {teamName}
        </h2>
        <p style={{ color: "var(--color-muted)", fontSize: "clamp(0.82rem, 1.3vw, 1rem)", lineHeight: 1.45, marginTop: "0.55rem" }}>
          {leadInstitution ?? institutions.slice(0, 2).join(" · ") ?? "Team affiliation pending"}
        </p>
      </div>

      {members.length === 0 ? (
        <p style={{ color: "var(--color-muted)", fontSize: "1rem" }}>Team information has not been added yet.</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "0.75rem" }}>
          {members.map((member, index) => (
            <article
              key={`${member.name}-${index}`}
              style={{
                border: "1px solid rgba(255,255,255,0.10)",
                background: "rgba(255,255,255,0.045)",
                borderRadius: 18,
                padding: "0.85rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.6rem", marginBottom: "0.45rem" }}>
                <div style={{ color: "var(--color-fg)", fontWeight: 900, fontSize: "clamp(0.95rem, 1.4vw, 1.15rem)", lineHeight: 1.15 }}>
                  {member.name}
                </div>
                {member.role === "Team Lead" && (
                  <span className="badge badge-success" style={{ flexShrink: 0, fontSize: "0.58rem" }}>Team Lead</span>
                )}
              </div>
              <div style={{ display: "grid", gap: "0.28rem", color: "var(--color-muted)", fontSize: "clamp(0.72rem, 1.05vw, 0.88rem)", lineHeight: 1.35 }}>
                <div>{member.degrees || "—"}</div>
                <div>{member.affiliation || "—"}</div>
                <div style={{ color: member.isStudentTrainee ? "var(--color-success)" : "var(--color-subtle)", fontWeight: 750 }}>
                  {member.isStudentTrainee ? "✓ Student / Trainee" : "—"}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
