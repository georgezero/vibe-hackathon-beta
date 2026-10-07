"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function JoinInvitationClient({
  teamName,
  projectTitle,
  ownerName,
  intendedMemberName,
  signedInAs,
  expiresAt,
}: {
  teamName: string;
  projectTitle: string | null;
  ownerName: string | null;
  intendedMemberName: string | null;
  signedInAs: string;
  expiresAt: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function accept() {
    setPending(true);
    setError("");
    const response = await fetch("/api/submission-memberships/invitations/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    const body = await response.json().catch(() => ({})) as { error?: string; submissionId?: string };
    setPending(false);
    if (!response.ok) {
      setError(body.error ?? "This invitation could not be accepted.");
      return;
    }
    router.push(`/projects/${encodeURIComponent(body.submissionId ?? "")}?joined=1`);
  }

  return (
    <section className="card" style={{ padding: "1.5rem" }}>
      <span className="badge badge-success">Private team invitation</span>
      <h1 style={{ color: "var(--color-fg)", fontFamily: "var(--font-headline)", fontSize: "2rem", letterSpacing: "-0.04em", marginTop: "0.8rem" }}>
        Join {teamName}
      </h1>
      <p style={{ color: "var(--color-muted)", lineHeight: 1.65, marginTop: "0.6rem" }}>
        {projectTitle ? `You've been invited to collaborate on ${projectTitle}.` : "You've been invited to collaborate on this private project."}
      </p>
      <dl style={{ display: "grid", gap: "0.7rem", margin: "1.25rem 0", color: "var(--color-muted)", fontSize: "0.86rem" }}>
        <div><dt style={{ color: "var(--color-subtle)", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>Team lead</dt><dd style={{ color: "var(--color-fg)", marginTop: "0.2rem" }}>{ownerName ?? "Team lead"}</dd></div>
        {intendedMemberName && <div><dt style={{ color: "var(--color-subtle)", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>Prepared for</dt><dd style={{ color: "var(--color-fg)", marginTop: "0.2rem" }}>{intendedMemberName}</dd></div>}
        <div><dt style={{ color: "var(--color-subtle)", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>Access</dt><dd style={{ color: "var(--color-fg)", marginTop: "0.2rem" }}>Private project and Team Chat after you join</dd></div>
        <div><dt style={{ color: "var(--color-subtle)", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>Invitation</dt><dd style={{ color: "var(--color-fg)", marginTop: "0.2rem" }}>Expires {new Date(expiresAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</dd></div>
      </dl>
      {error && <p role="alert" className="badge badge-error" style={{ marginBottom: "0.9rem" }}>{error}</p>}
      <p style={{ color: "var(--color-muted)", fontSize: "0.8rem", lineHeight: 1.55, marginBottom: "1rem" }}>
        You&apos;re signed in as <strong style={{ color: "var(--color-fg)" }}>{signedInAs}</strong>. Joining adds project access to this account. If that is not the account you want to use, sign out before continuing. It does not grant administrator or judge access; the team lead can update the listed team separately.
      </p>
      <button type="button" className="btn-primary" onClick={accept} disabled={pending}>
        {pending ? "Joining…" : "Join project"}
      </button>
    </section>
  );
}
