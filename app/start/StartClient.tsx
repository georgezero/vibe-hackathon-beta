"use client";

import { useState } from "react";
import Link from "next/link";
import { SaveProjectCard } from "@/components/SaveProjectCard";

type CreatedProject = { id: string; token: string; startUrl: string };

function absoluteProjectLink(path: string) {
  if (typeof window === "undefined") return path;
  return new URL(path, window.location.origin).toString();
}

export function StartClient({ eventName }: { eventName: string }) {
  const [form, setForm] = useState({ teamName: "", ownerName: "", contactEmail: "", ownerBadgeNumber: "" });
  const [created, setCreated] = useState<CreatedProject | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setPending(true);
    const response = await fetch("/api/register-team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, teammates: [], source: "start" }),
    });
    const data = await response.json().catch(() => ({})) as { id?: string; editToken?: string; start_url?: string; error?: string };
    setPending(false);
    if (!response.ok || !data.id || !data.editToken) {
      setError(data.error ?? "We could not create your project. Check the highlighted details and try again.");
      return;
    }
    setCreated({ id: data.id, token: data.editToken, startUrl: data.start_url ?? `/submit/${data.editToken}/start` });
  }

  async function copyProjectLink() {
    if (!created) return;
    await navigator.clipboard.writeText(absoluteProjectLink(created.startUrl));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  if (created) {
    return (
      <div className="flex flex-col gap-5">
        <section className="card" style={{ padding: "1.5rem" }}>
          <span className="badge badge-success">Project created</span>
          <h1 style={{ color: "var(--color-fg)", fontFamily: "var(--font-headline)", fontSize: "clamp(2.2rem, 7vw, 3.6rem)", letterSpacing: "-0.06em", lineHeight: 0.98, margin: "0.8rem 0 0.65rem" }}>
            Your project is ready
          </h1>
          <p style={{ color: "var(--color-muted)", lineHeight: 1.65, maxWidth: "42rem" }}>
            We created a private draft for your team. Save it to My Projects or continue without an account.
          </p>
        </section>

        <SaveProjectCard submissionId={created.id} editToken={created.token} />

        <section className="card" style={{ padding: "1.25rem" }}>
          <h2 style={{ color: "var(--color-fg)", fontWeight: 850, fontSize: "1.15rem" }}>How would you like to continue?</h2>
          <p style={{ color: "var(--color-muted)", fontSize: "0.85rem", lineHeight: 1.6, marginTop: "0.4rem" }}>
            You can switch between these paths later. Your project stays private until you choose to submit it.
          </p>
          <div className="flex flex-wrap gap-2" style={{ marginTop: "1rem" }}>
            <Link href={created.startUrl} className="btn-primary">Continue without an account</Link>
          </div>
        </section>

        <details className="card" style={{ padding: "1rem 1.25rem" }}>
          <summary style={{ color: "var(--color-fg)", fontWeight: 750, cursor: "pointer" }}>Recovery details</summary>
          <p style={{ color: "var(--color-muted)", fontSize: "0.82rem", lineHeight: 1.6, marginTop: "0.75rem" }}>
            If you continue without an account, save this private project link. Anyone with it can edit the project.
          </p>
          <button type="button" className="btn-secondary" onClick={copyProjectLink} style={{ marginTop: "0.8rem" }}>
            {copied ? "Private link copied" : "Copy private project link"}
          </button>
          <div className="flex flex-col gap-2" style={{ marginTop: "1rem", paddingTop: "0.9rem", borderTop: "1px solid var(--color-border)" }}>
            <RecoveryValue label="Project ID" value={created.id} />
            <RecoveryValue label="Edit token" value={created.token} secret />
          </div>
        </details>
      </div>
    );
  }

  return (
    <>
      <form onSubmit={submit} className="card" style={{ padding: "1.5rem" }}>
        <span className="badge badge-accent">{eventName}</span>
        <h1 style={{ fontFamily: "var(--font-headline)", color: "var(--color-fg)", fontSize: "clamp(2.35rem, 7vw, 3.5rem)", letterSpacing: "-0.06em", lineHeight: 0.98, margin: "0.8rem 0 0.7rem" }}>Start your project</h1>
        <p style={{ color: "var(--color-muted)", lineHeight: 1.65 }}>
          Create a private project draft for your team. You can add teammates and finish the details afterward. No account is required to begin.
        </p>
        <p style={{ color: "var(--color-muted)", fontSize: "0.84rem", lineHeight: 1.6, marginTop: "0.65rem" }}>
          The usual path is simple: create the draft, add team details, complete the project form, review Preview, then submit when you are ready. Save it to My Projects if you want to return from any device.
        </p>

        <fieldset style={{ border: 0, padding: 0, margin: "1.5rem 0 0" }}>
          <legend style={{ color: "var(--color-fg)", fontWeight: 850, fontSize: "1rem", marginBottom: "0.75rem" }}>Project</legend>
          <Field label="Team name *" value={form.teamName} onChange={(value) => setForm({ ...form, teamName: value })} />
        </fieldset>

        <fieldset style={{ border: 0, padding: 0, margin: "1.35rem 0 0" }}>
          <legend style={{ color: "var(--color-fg)", fontWeight: 850, fontSize: "1rem", marginBottom: "0.75rem" }}>Team lead</legend>
          <div className="flex flex-col gap-4">
            <Field label="Name *" value={form.ownerName} onChange={(value) => setForm({ ...form, ownerName: value })} />
            <Field label="Contact email *" type="email" value={form.contactEmail} onChange={(value) => setForm({ ...form, contactEmail: value })} />
            <div>
              <label className="label" htmlFor="owner-badge-number">Badge number *</label>
              <input id="owner-badge-number" className="input" value={form.ownerBadgeNumber} onChange={(event) => setForm({ ...form, ownerBadgeNumber: event.target.value })} required aria-describedby="badge-number-help" />
              <p id="badge-number-help" style={{ color: "var(--color-subtle)", fontSize: "0.75rem", lineHeight: 1.5, marginTop: "0.35rem" }}>Used to verify event participation and prize eligibility.</p>
            </div>
          </div>
        </fieldset>

        {error && <p role="alert" className="badge badge-error" style={{ marginTop: "1rem" }}>{error}</p>}
        <button className="btn-primary" type="submit" disabled={pending} style={{ marginTop: "1.4rem", width: "100%", justifyContent: "center" }}>{pending ? "Creating project…" : "Create project"}</button>
      </form>
      <p style={{ color: "var(--color-subtle)", fontSize: "0.8rem", textAlign: "center", marginTop: "1rem" }}>Already started? <Link href="/start/resume" style={{ color: "var(--color-accent)" }}>Resume a project</Link></p>
    </>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  const id = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return <div><label className="label" htmlFor={id}>{label}</label><input id={id} className="input" type={type} value={value} onChange={(event) => onChange(event.target.value)} required /></div>;
}

function RecoveryValue({ label, value, secret = false }: { label: string; value: string; secret?: boolean }) {
  return <div className="flex items-start justify-between gap-3"><span style={{ color: "var(--color-subtle)", fontSize: "0.76rem" }}>{label}</span><code style={{ color: secret ? "var(--color-accent)" : "var(--color-fg)", fontSize: "0.75rem", wordBreak: "break-all", textAlign: "right" }}>{value}</code></div>;
}
