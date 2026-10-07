"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ClaimConfirmClient({ teamName }: { teamName: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function confirm() {
    setPending(true); setError("");
    const response = await fetch("/api/submissions/claim/confirm", { method: "POST" });
    const body = await response.json().catch(() => ({})) as { error?: string; success?: boolean };
    setPending(false);
    if (!response.ok) { setError(body.error ?? "This claim could not be completed."); return; }
    router.push("/account/projects?claimed=1");
  }

  async function cancel() {
    await fetch("/api/submissions/claim/cancel", { method: "POST" });
    router.push("/account/projects");
  }

  return (
    <section className="card" style={{ padding: "1.6rem" }}>
      <span className="badge badge-accent">Save a project</span>
      <h1 style={{ fontFamily: "var(--font-headline)", color: "var(--color-fg)", fontSize: "2rem", margin: "0.9rem 0 0.6rem" }}>Save this project?</h1>
      <p style={{ color: "var(--color-muted)", lineHeight: 1.65 }}>Save <strong style={{ color: "var(--color-fg)" }}>{teamName}</strong> to My Projects so you can return from any device without the private project link.</p>
      <p style={{ color: "var(--color-subtle)", fontSize: "0.8rem", lineHeight: 1.55, marginTop: "0.8rem" }}>This only adds the project to your account. It does not submit the project or grant administrator or judge access.</p>
      {error && <p role="alert" className="badge badge-error" style={{ marginTop: "1rem" }}>{error}</p>}
      <div className="flex flex-wrap gap-2" style={{ marginTop: "1.4rem" }}>
        <button className="btn-primary" type="button" disabled={pending} onClick={confirm}>{pending ? "Saving…" : "Save to My Projects"}</button>
        <button className="btn-secondary" type="button" onClick={cancel}>Maybe later</button>
      </div>
    </section>
  );
}
