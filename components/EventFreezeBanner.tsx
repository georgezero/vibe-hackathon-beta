import { getEventFreezeState } from "@/lib/event-freeze";

export async function EventFreezeBanner({ admin = false }: { admin?: boolean }) {
  const { frozen } = await getEventFreezeState();
  if (!frozen) return null;
  return (
    <div style={{
      borderBottom: "1px solid var(--color-border)",
      background: "color-mix(in srgb, var(--color-warning) 16%, var(--color-surface))",
      color: "var(--color-fg)",
      padding: "0.75rem 1rem",
      textAlign: "center",
      fontWeight: 800,
    }}>
      🏁 Event Frozen <span style={{ color: "var(--color-muted)", fontWeight: 600, marginLeft: "0.5rem" }}>{admin ? "No new teams, updates, or submissions." : "No new teams, updates, or submissions."}</span>
    </div>
  );
}
