"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ClaimClient() {
  const router = useRouter();
  const [submissionId, setSubmissionId] = useState("");
  const [editToken, setEditToken] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError(""); setPending(true);
    const response = await fetch("/api/submissions/claim/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ submissionId, editToken }) });
    const body = await response.json().catch(() => ({})) as { next?: string; authenticated?: boolean; error?: string };
    setPending(false);
    if (!response.ok) { setError(body.error ?? "We could not verify those submission details."); return; }
    // Anonymous claim transactions must pass through the normal login route so
    // Better Auth can establish the session before the confirmation page reads
    // the bound transaction cookie. Authenticated users can confirm directly.
    router.push(body.authenticated ? "/claim/confirm" : "/login?returnTo=%2Fclaim%2Fconfirm");
  }
  return <section className="card" style={{ padding: "1.6rem" }}><span className="badge badge-default">Save a project</span><h1 style={{ fontFamily: "var(--font-headline)", color: "var(--color-fg)", fontSize: "2.2rem", letterSpacing: "-0.04em", margin: "0.9rem 0 0.6rem" }}>Save this project to My Projects</h1><p style={{ color: "var(--color-muted)", lineHeight: 1.65 }}>Use the private project details from the project-creation screen. Once saved, you can return from any device without re-entering the private link.</p><form onSubmit={submit} className="flex flex-col gap-4" style={{ marginTop: "1.2rem" }}><label className="label" htmlFor="claim-project-id">Project ID<input id="claim-project-id" className="input" value={submissionId} onChange={(event) => setSubmissionId(event.target.value)} required /></label><label className="label" htmlFor="claim-edit-token">Edit token<input id="claim-edit-token" className="input" value={editToken} onChange={(event) => setEditToken(event.target.value)} required autoComplete="off" /></label>{error && <p role="alert" className="badge badge-error">{error}</p>}<button className="btn-primary" type="submit" disabled={pending}>{pending ? "Checking…" : "Continue to account"}</button></form></section>;
}
