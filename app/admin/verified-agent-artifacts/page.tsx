import Link from "next/link";
import { cookies } from "next/headers";
import { desc } from "drizzle-orm";
import { Nav } from "@/components/Nav";
import { VerifiedArtifactControls } from "@/components/viby/VerifiedArtifactControls";
import { VibyArtifactSeal } from "@/components/viby/VibyArtifactSeal";
import { requireAdminSession } from "@/lib/admin-session";
import { applicationHeaderAccount } from "@/lib/application-account-display";
import { db } from "@/lib/db";
import { submissions } from "@/lib/db/schema";
import {
  VERIFIED_ARTIFACT_TYPES,
  VERIFIED_ARTIFACT_COOKIE,
  artifactTypeConfig,
  decodeVerifiedArtifact,
  formatVerifiedArtifactExport,
  normalizeArtifactType,
} from "@/lib/verifiedArtifacts";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

interface ProjectOption {
  id: string;
  projectTitle: string | null;
  teamName: string;
  status: string;
  problemStatement: string | null;
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function safeReason(reason: string | undefined) {
  return reason ? reason.replace(/_/g, " ") : null;
}

function artifactStartUrl(projectId: string, artifactType: string) {
  const normalizedArtifactType = normalizeArtifactType(artifactType);
  return `/api/viby/start?flow=artifact&projectId=${encodeURIComponent(projectId)}&artifactType=${encodeURIComponent(normalizedArtifactType)}`;
}

export default async function VerifiedAgentArtifactsPage({ searchParams }: Props) {
  const adminSession = await requireAdminSession();
  const params = await searchParams;
  const status = first(params.viby_status);
  const reason = first(params.reason);
  const message = first(params.message);
  const selectedProjectId = first(params.projectId);
  const selectedArtifactType = normalizeArtifactType(first(params.artifactType));
  const selectedArtifactConfig = artifactTypeConfig(selectedArtifactType);
  const artifactToken = first(params.artifact);
  const cookieArtifactToken = status === "allowed"
    ? (await cookies()).get(VERIFIED_ARTIFACT_COOKIE)?.value
    : undefined;
  const artifactSource = artifactToken ?? cookieArtifactToken;
  const artifact = artifactSource ? decodeVerifiedArtifact(artifactSource) : null;
  const artifactInvalid = Boolean(artifactSource && !artifact);
  const artifactExportText = artifact ? formatVerifiedArtifactExport(artifact) : null;

  const projectRows: ProjectOption[] = await db
    .select({
      id: submissions.id,
      projectTitle: submissions.projectTitle,
      teamName: submissions.teamName,
      status: submissions.status,
      problemStatement: submissions.problemStatement,
    })
    .from(submissions)
    .orderBy(desc(submissions.createdAt))
    .limit(24);

  const selectedProject = projectRows.find((project) => project.id === selectedProjectId) ?? projectRows[0] ?? null;

  return (
    <div className="flex flex-col min-h-screen">
      <Nav authenticatedAccount={applicationHeaderAccount(adminSession)} />
      <main className="flex-1 px-4 py-10">
        <div style={{ width: "100%", maxWidth: 980, margin: "0 auto" }}>
          <Link href="/admin/dashboard" style={{ color: "var(--color-accent)", fontSize: "0.875rem", textDecoration: "none" }}>
            Back to admin dashboard
          </Link>

          <section className="card" style={{ padding: "1.5rem", marginTop: "1rem" }}>
            <div className="badge badge-default" style={{ marginBottom: "0.75rem" }}>
              Phase 8 Demo
            </div>
            <h1
              style={{
                fontFamily: "var(--font-headline)",
                fontSize: "1.95rem",
                fontWeight: 900,
                letterSpacing: "-0.04em",
                color: "var(--color-fg)",
                marginBottom: "0.5rem",
              }}
            >
              Verified Agent Artifacts
            </h1>
              <p style={{ color: "var(--color-muted)", fontSize: "0.95rem", lineHeight: 1.6, maxWidth: 700 }}>
              Generate a Vibe artifact with a Viby-linked agent, then attach a
              Viby verification mark. Viby confirms the agent identity and owner;
              Vibe Hackathon owns the artifact text, hash, display, and authorization.
            </p>
          </section>

          <section className="grid lg:grid-cols-[0.85fr_1.15fr] gap-4" style={{ marginTop: "1rem" }}>
            <div className="card" style={{ padding: "1.25rem" }}>
              <h2 style={{ color: "var(--color-fg)", fontWeight: 850, fontSize: "1.1rem", marginBottom: "0.35rem" }}>
                Artifact Generation
              </h2>
              <p style={{ color: "var(--color-muted)", fontSize: "0.875rem", lineHeight: 1.55, marginBottom: "1rem" }}>
                Choose an artifact type and project, then confirm an agent actor in Viby. The artifact
                output is simulated in Vibe for now; the verification trail is the
                important part.
              </p>

              {projectRows.length === 0 ? (
                <Notice tone="warning" title="No projects available">
                  Seed or submit a project before running the artifact demo.
                </Notice>
              ) : (
                <div className="grid gap-3">
                  <div>
                    <div style={{ color: "var(--color-subtle)", fontFamily: "var(--font-mono)", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.5rem" }}>
                      Artifact Type
                    </div>
                    <div className="grid gap-2">
                      {VERIFIED_ARTIFACT_TYPES.map((item) => {
                        const active = selectedArtifactType === item.type;
                        const href = `/admin/verified-agent-artifacts?projectId=${encodeURIComponent(selectedProject?.id ?? projectRows[0]?.id ?? "")}&artifactType=${encodeURIComponent(item.type)}`;
                        return (
                          <Link
                            key={item.type}
                            href={href}
                            scroll={false}
                            className="card"
                            style={{
                              padding: "0.875rem",
                              textDecoration: "none",
                              borderColor: active ? "var(--color-accent)" : "var(--color-border)",
                              background: active ? "color-mix(in srgb, var(--color-accent) 8%, var(--color-surface))" : undefined,
                            }}
                          >
                            <div style={{ color: "var(--color-fg)", fontWeight: 800, fontSize: "0.9rem" }}>{item.label}</div>
                            <div style={{ color: "var(--color-muted)", fontSize: "0.75rem", marginTop: "0.2rem", lineHeight: 1.4 }}>
                              {item.description}
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                    <div style={{ color: "var(--color-subtle)", fontFamily: "var(--font-mono)", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.08em", margin: "1rem 0 0.5rem" }}>
                      Coming Soon
                    </div>
                    <div className="grid gap-2">
                      {["Technical Review", "Product Review", "Architecture Summary", "Judge Evaluation"].map((label) => (
                        <div
                          key={label}
                          className="card"
                          style={{
                            padding: "0.875rem",
                            opacity: 0.58,
                            background: "var(--color-surface-2)",
                          }}
                        >
                          <div style={{ color: "var(--color-fg)", fontWeight: 800, fontSize: "0.875rem" }}>{label}</div>
                          <div style={{ color: "var(--color-muted)", fontSize: "0.72rem", marginTop: "0.2rem" }}>
                            Coming Soon
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ color: "var(--color-subtle)", fontFamily: "var(--font-mono)", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: "0.25rem" }}>
                    Project
                  </div>
                  {projectRows.slice(0, 8).map((project) => {
                    const active = selectedProject?.id === project.id;
                    return (
                      <Link
                        key={project.id}
                        href={`/admin/verified-agent-artifacts?projectId=${encodeURIComponent(project.id)}&artifactType=${encodeURIComponent(selectedArtifactType)}`}
                        scroll={false}
                        className="card"
                        style={{
                          padding: "0.875rem",
                          textDecoration: "none",
                          borderColor: active ? "var(--color-accent)" : "var(--color-border)",
                          background: active ? "color-mix(in srgb, var(--color-accent) 8%, var(--color-surface))" : undefined,
                        }}
                      >
                        <div style={{ color: "var(--color-fg)", fontWeight: 800, fontSize: "0.925rem" }}>
                          {project.projectTitle ?? project.teamName}
                        </div>
                        <div style={{ color: "var(--color-muted)", fontSize: "0.75rem", marginTop: "0.2rem" }}>
                          {project.teamName} · {project.status}
                        </div>
                      </Link>
                    );
                  })}

                  {selectedProject && (
                    <a className="btn-primary" href={artifactStartUrl(selectedProject.id, selectedArtifactType)} style={{ justifyContent: "center" }}>
                      Generate with Viby Agent
                    </a>
                  )}
                </div>
              )}
            </div>

            <div className="card" style={{ padding: "1.25rem" }}>
              <h2 style={{ color: "var(--color-fg)", fontWeight: 850, fontSize: "1.1rem", marginBottom: "0.35rem" }}>
                Verified Artifact
              </h2>

              {artifact && (
                <div>
                  <Notice tone="success" title="Verified Artifact Generated">
                    Vibe generated this artifact, hashed the final text, and attached a Viby-verified agent identity seal.
                  </Notice>
                  <div className="flex flex-wrap gap-2" style={{ marginBottom: "0.875rem" }}>
                    <span className="badge badge-success">Verified artifact</span>
                    <span className="badge badge-default">Actor type: agent</span>
                    <span className="badge badge-success">sha256</span>
                  </div>
                  <h3 style={{ color: "var(--color-fg)", fontWeight: 900, fontSize: "1.5rem", lineHeight: 1.1, marginBottom: "0.35rem" }}>
                    {artifact.projectTitle}
                  </h3>
                  <p style={{ color: "var(--color-muted)", fontSize: "0.875rem", marginBottom: "1rem" }}>
                    {artifactTypeConfig(artifact.artifactType).label} generated by {artifact.generatedByAgentName}, owned by {artifact.ownerDisplayName}.
                  </p>

                  <div
                    style={{
                      border: "1px solid var(--color-border)",
                      borderRadius: 14,
                      padding: "1rem",
                      background: "var(--color-surface-2)",
                      color: "var(--color-fg)",
                      lineHeight: 1.65,
                      marginBottom: "1rem",
                    }}
                  >
                      {artifact.content}
                    </div>

                  <VibyArtifactSeal artifact={artifact} />
                  <div style={{ marginTop: "1rem" }}>
                    <VerifiedArtifactControls
                      artifact={artifact}
                      artifactToken={artifactSource}
                      exportText={artifactExportText}
                    />
                  </div>

                  <details style={{ marginTop: "1rem" }}>
                    <summary style={{ color: "var(--color-muted)", fontFamily: "var(--font-mono)", fontSize: "0.75rem", cursor: "pointer" }}>
                      Technical details
                    </summary>
                    <div className="grid sm:grid-cols-2 gap-2" style={{ marginTop: "0.75rem" }}>
                      <Info label="Action" value={artifact.actionName} />
                      <Info label="Artifact type" value={artifactTypeConfig(artifact.artifactType).label} />
                      <Info label="Created at" value={new Date(artifact.createdAt).toLocaleString()} />
                      <Info label="Full SHA-256" value={`sha256:${artifact.sha256}`} mono />
                      <Info label="Issued time" value={artifact.signature.issuedAt ? new Date(artifact.signature.issuedAt).toLocaleString() : "unknown"} />
                      <Info label="Expires time" value={artifact.signature.expiresAt ? new Date(artifact.signature.expiresAt).toLocaleString() : "unknown"} />
                      <Info label="Actor type" value={artifact.signature.actorType} mono />
                    </div>
                  </details>
                </div>
              )}

              {!artifact && status === "denied" && (
                <Notice tone="warning" title="Viby request was denied">
                  No project summary artifact was generated.
                  {safeReason(reason) ? ` Reason: ${safeReason(reason)}.` : ""}
                </Notice>
              )}

              {!artifact && (status === "error" || artifactInvalid) && (
                <Notice tone="error" title="Artifact verification failed">
                  {artifactInvalid ? "The artifact payload was tampered with or could not be verified." : message ?? "The Viby artifact flow could not be completed."}
                  {safeReason(reason) ? ` Reason: ${safeReason(reason)}.` : ""}
                </Notice>
              )}

              {!artifact && status === "allowed" && !artifactInvalid && (
                <Notice tone="error" title="Artifact result missing">
                  Vibe verified the Viby callback, but the signed artifact result was not available. Restart the generation flow.
                </Notice>
              )}

              {!artifact && !status && !artifactInvalid && (
                <div style={{ color: "var(--color-muted)", fontSize: "0.9rem", lineHeight: 1.6 }}>
                  No artifact generated yet. Choose a project and click
                  <strong style={{ color: "var(--color-fg)" }}> Generate with Viby Agent</strong>.
                  <span style={{ display: "block", marginTop: "0.5rem" }}>
                    Current type: <strong style={{ color: "var(--color-fg)" }}>{selectedArtifactConfig.label}</strong>.
                  </span>
                </div>
              )}
            </div>
          </section>
          {!artifact && (
            <section style={{ marginTop: "1rem" }}>
              <VerifiedArtifactControls />
            </section>
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
      <div style={{ color: "var(--color-fg)", fontSize: "0.825rem", fontFamily: mono ? "var(--font-mono)" : undefined, overflowWrap: "anywhere" }}>
        {value}
      </div>
    </div>
  );
}

function Notice({ tone, title, children }: {
  tone: "warning" | "error" | "success";
  title: string;
  children: React.ReactNode;
}) {
  const colors = {
    warning: ["var(--color-warning)", "color-mix(in srgb, var(--color-warning) 12%, transparent)"],
    error: ["var(--color-error)", "color-mix(in srgb, var(--color-error) 12%, transparent)"],
    success: ["var(--color-success)", "color-mix(in srgb, var(--color-success) 12%, transparent)"],
  }[tone];
  return (
    <div
      style={{
        border: `1px solid ${colors[0]}`,
        background: colors[1],
        borderRadius: 12,
        padding: "0.875rem 1rem",
        color: "var(--color-fg)",
      }}
    >
      <div style={{ fontWeight: 800, marginBottom: "0.25rem" }}>{title}</div>
      <div style={{ color: "var(--color-muted)", fontSize: "0.875rem", lineHeight: 1.5 }}>{children}</div>
    </div>
  );
}
