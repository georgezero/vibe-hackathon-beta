import Link from "next/link";
import { Nav } from "@/components/Nav";
import { requireAdminSession } from "@/lib/admin-session";
import { applicationHeaderAccount } from "@/lib/application-account-display";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function safeReason(reason: string | undefined) {
  return reason ? reason.replace(/_/g, " ") : null;
}

export default async function AgentAttributionDemoPage({ searchParams }: Props) {
  const adminSession = await requireAdminSession();
  const params = await searchParams;
  const status = first(params.viby_status);
  const reason = first(params.reason);
  const actorType = first(params.actor_type);
  const agentName = first(params.agent_name);
  const agentDisplayName = first(params.agent);
  const ownerDisplayName = first(params.owner);
  const delegationMethod = first(params.delegation_method);
  const issuedAt = first(params.issued_at);
  const expiresAt = first(params.expires_at);
  const message = first(params.message);
  const displayedAgent = agentDisplayName || agentName || "Agent identity";
  const displayedOwner = ownerDisplayName || "Verified owner";

  return (
    <div className="flex flex-col min-h-screen">
      <Nav authenticatedAccount={applicationHeaderAccount(adminSession)} />
      <main className="flex-1 px-4 py-10">
        <div style={{ width: "100%", maxWidth: 760, margin: "0 auto" }}>
          <Link href="/admin/dashboard" style={{ color: "var(--color-accent)", fontSize: "0.875rem", textDecoration: "none" }}>
            Back to admin dashboard
          </Link>

          <div className="card" style={{ padding: "1.5rem", marginTop: "1rem" }}>
            <div className="badge badge-default" style={{ marginBottom: "0.75rem" }}>
              Viby Agent Attribution
            </div>
            <h1
              style={{
                fontFamily: "var(--font-headline)",
                fontSize: "1.85rem",
                fontWeight: 850,
                letterSpacing: "-0.03em",
                color: "var(--color-fg)",
                marginBottom: "0.5rem",
              }}
            >
              Agent Attribution Demo
            </h1>
            <p style={{ color: "var(--color-muted)", fontSize: "0.925rem", lineHeight: 1.6, maxWidth: 620 }}>
              Use Viby to attribute an action to a human-owned AI agent. Vibe Hackathon
              still controls authorization; Viby only confirms the actor identity and
              delegation relationship.
            </p>

            <div style={{ marginTop: "1.25rem" }}>
              <a className="btn-primary" href="/api/viby/start?flow=agent">
                Attribute Action with Viby
              </a>
            </div>
          </div>

          {status === "allowed" && (
            <div className="card" style={{ padding: "1.5rem", marginTop: "1rem", borderColor: "var(--color-success)" }}>
              <div className="flex flex-wrap gap-2" style={{ marginBottom: "0.875rem" }}>
                <div className="badge badge-success">Agent action attributed</div>
                <div className="badge badge-default">Actor type: {actorType ?? "agent"}</div>
                <div className="badge badge-success">Assertion: Allowed</div>
              </div>
              <h2 style={{ color: "var(--color-fg)", fontWeight: 900, fontSize: "2rem", lineHeight: 1.1, marginBottom: "0.35rem", letterSpacing: "-0.03em" }}>
                {displayedAgent}
              </h2>
              <p style={{ color: "var(--color-muted)", fontSize: "1rem", marginBottom: "1rem" }}>
                Owned by {displayedOwner}
              </p>
              <div
                style={{
                  border: "1px solid color-mix(in srgb, var(--color-success) 35%, transparent)",
                  background: "color-mix(in srgb, var(--color-success) 10%, transparent)",
                  borderRadius: 14,
                  padding: "1rem",
                  marginBottom: "1rem",
                }}
              >
                <div style={{ color: "var(--color-subtle)", fontFamily: "var(--font-mono)", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.35rem" }}>
                  Action attribution
                </div>
                <div style={{ color: "var(--color-fg)", fontSize: "1.05rem", fontWeight: 800 }}>
                  {displayedAgent} performed an agent attribution demo action.
                </div>
                <p style={{ color: "var(--color-muted)", fontSize: "0.875rem", lineHeight: 1.5, marginTop: "0.5rem" }}>
                  Viby confirmed this agent is linked to {displayedOwner}. Vibe Hackathon still decides what this actor is allowed to do.
                </p>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <Info label="Demo action" value="Performed agent attribution demo action" />
                <Info label="Delegation" value={delegationMethod === "owner_registered" ? "Owner registered" : delegationMethod ?? "Owner registered"} />
                <Info label="Issued" value={issuedAt ? new Date(issuedAt).toLocaleString() : "just now"} />
                <Info label="Expires" value={expiresAt ? new Date(expiresAt).toLocaleString() : "unknown"} />
              </div>
              <details style={{ marginTop: "1rem" }}>
                <summary style={{ color: "var(--color-muted)", fontFamily: "var(--font-mono)", fontSize: "0.75rem", cursor: "pointer" }}>
                  Technical details
                </summary>
                <div className="grid gap-2" style={{ marginTop: "0.75rem" }}>
                  {agentName && <Info label="Agent name" value={agentName} />}
                  <Info label="Actor type" value={actorType ?? "agent"} mono />
                  <Info label="Audience" value="vibe-hackathon" mono />
                  <Info label="Mode" value="agent-attribution" mono />
                </div>
              </details>
            </div>
          )}

          {status === "denied" && (
            <Notice tone="warning" title="Viby request was denied">
              No agent attribution event was created.
              {safeReason(reason) ? ` Reason: ${safeReason(reason)}.` : ""}
            </Notice>
          )}

          {status === "error" && (
            <Notice tone="error" title="Viby could not complete the request">
              {message ?? "The agent attribution assertion could not be verified."}
              {safeReason(reason) ? ` Reason: ${safeReason(reason)}.` : ""}
            </Notice>
          )}
        </div>
      </main>
    </div>
  );
}

function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="card" style={{ padding: "0.75rem" }}>
      <div style={{ color: "var(--color-subtle)", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "var(--font-mono)" }}>
        {label}
      </div>
      <div style={{ color: "var(--color-fg)", fontSize: "0.875rem", fontFamily: mono ? "var(--font-mono)" : undefined, overflowWrap: "anywhere" }}>
        {value}
      </div>
    </div>
  );
}

function Notice({ tone, title, children }: {
  tone: "warning" | "error";
  title: string;
  children: React.ReactNode;
}) {
  const colors = {
    warning: ["var(--color-warning)", "color-mix(in srgb, var(--color-warning) 12%, transparent)"],
    error: ["var(--color-error)", "color-mix(in srgb, var(--color-error) 12%, transparent)"],
  }[tone];
  return (
    <div
      style={{
        border: `1px solid ${colors[0]}`,
        background: colors[1],
        borderRadius: 12,
        padding: "0.875rem 1rem",
        marginTop: "1rem",
        color: "var(--color-fg)",
      }}
    >
      <div style={{ fontWeight: 800, marginBottom: "0.25rem" }}>{title}</div>
      <div style={{ color: "var(--color-muted)", fontSize: "0.875rem", lineHeight: 1.5 }}>{children}</div>
    </div>
  );
}
