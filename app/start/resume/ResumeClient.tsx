"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function ResumeClient() {
  const router = useRouter();
  const [projectId, setProjectId] = useState("");
  const [editToken, setEditToken] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    const response = await fetch("/api/submissions/resume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ submissionId: projectId, editToken }),
    });
    const body = await response.json().catch(() => ({})) as { next?: string; error?: string };
    setPending(false);
    if (!response.ok) {
      setError(body.error ?? "We could not find that project. Check the private details and try again.");
      return;
    }
    router.push(body.next ?? "/start");
  }

  return (
    <section className="card" style={{ padding: "1.6rem" }}>
      <span className="badge badge-default">Private project</span>
      <h1 style={{ fontFamily: "var(--font-headline)", color: "var(--color-fg)", fontSize: "2.2rem", letterSpacing: "-0.04em", margin: "0.9rem 0 0.6rem" }}>Resume a project</h1>
      <p style={{ color: "var(--color-muted)", lineHeight: 1.65 }}>Enter the Project ID and private edit token from your project-creation screen.</p>
      <form className="flex flex-col gap-4" style={{ marginTop: "1.2rem" }} onSubmit={submit}>
        <label className="label" htmlFor="resume-project-id">Project ID<input id="resume-project-id" className="input" value={projectId} onChange={(event) => setProjectId(event.target.value)} required /></label>
        <label className="label" htmlFor="resume-edit-token">Edit token<input id="resume-edit-token" className="input" value={editToken} onChange={(event) => setEditToken(event.target.value)} required autoComplete="off" aria-describedby="resume-token-help" /></label>
        <p id="resume-token-help" style={{ color: "var(--color-subtle)", fontSize: "0.75rem", lineHeight: 1.5, marginTop: "-0.6rem" }}>Anyone with the private token can edit the project. Keep it safe.</p>
        {error && <p role="alert" className="badge badge-error">{error}</p>}
        <button className="btn-primary" type="submit" disabled={pending}>{pending ? "Checking…" : "Resume project"}</button>
      </form>
      <p style={{ color: "var(--color-subtle)", fontSize: "0.8rem", lineHeight: 1.55, marginTop: "1.1rem" }}>Already saved it to your account? <Link href="/account/projects" style={{ color: "var(--color-accent)" }}>Open My Projects</Link>.</p>
    </section>
  );
}
