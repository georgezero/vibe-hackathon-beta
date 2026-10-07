"use client";

import { useEffect, useRef, useState } from "react";

const LABELS: Record<string, { label: string; placeholder: string }> = {
  badge: { label: "Badge number", placeholder: "123456" },
  email: { label: "Email address", placeholder: "you@example.com" },
  invite_code: { label: "Invite code", placeholder: "Enter your code" },
  anonymous: { label: "", placeholder: "" },
};

export default function ProjectVoteClient({ submissionId, initialVotes, votingOpen, resultsVisible, identityMethod, votingMode }: { submissionId: string; initialVotes: number; votingOpen: boolean; resultsVisible: boolean; identityMethod: string; votingMode: string }) {
  const [votes, setVotes] = useState(initialVotes);
  const [voted, setVoted] = useState(false);
  const [open, setOpen] = useState(false);
  const [identity, setIdentity] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const fingerprintRef = useRef("");
  const config = LABELS[identityMethod] ?? LABELS.badge;

  useEffect(() => {
    const stored = sessionStorage.getItem("vf");
    if (stored) fingerprintRef.current = stored;
    else {
      const f = Math.random().toString(36).slice(2);
      sessionStorage.setItem("vf", f);
      fingerprintRef.current = f;
    }
  }, []);

  async function submitAnonymous() {
    const res = await fetch("/api/votes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ submissionId, fingerprint: fingerprintRef.current }) });
    const data = await res.json();
    if (data.success) { setVotes(data.totalVotes); setVoted(true); }
    else if (data.alreadyVoted) setVoted(true);
    else setError(data.error ?? "Vote failed.");
  }

  async function submitIdentity(e: React.FormEvent) {
    e.preventDefault();
    if (!identity.trim()) { setError(`Enter your ${config.label.toLowerCase()}.`); return; }
    setSubmitting(true);
    setError("");
    const body: Record<string, string> = { submissionId, identityMethod, identity: identity.trim() };
    if (identityMethod === "badge" && email.trim()) body.email = email.trim();
    const res = await fetch("/api/v1/audience-vote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json();
    setSubmitting(false);
    if (data.success) { setVotes(data.totalVotes); setVoted(true); setOpen(false); }
    else setError(data.message ?? data.error ?? "Vote failed.");
  }

  async function handleVote() {
    if (!votingOpen || voted) return;
    if (votingMode === "human" && identityMethod !== "anonymous") setOpen(true);
    else await submitAnonymous();
  }

  return (
    <div id="project-vote-card" className="card" style={{ padding: "1.25rem" }}>
      <div style={{ fontSize: "0.75rem", color: "var(--color-subtle)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.35rem" }}>People&apos;s Choice</div>
      <div style={{ fontFamily: "var(--font-headline)", fontSize: "2rem", fontWeight: 800, color: "var(--color-fg)", lineHeight: 1 }}>{resultsVisible ? votes : "—"}</div>
      <div style={{ fontSize: "0.8125rem", color: "var(--color-muted)", margin: "0.25rem 0 1rem" }}>{resultsVisible ? "audience votes" : "results hidden"}</div>
      <button data-project-vote-button="true" onClick={handleVote} disabled={!votingOpen || voted} className={votingOpen && !voted ? "btn-primary" : "btn-secondary"} style={{ width: "100%", justifyContent: "center" }}>{!votingOpen ? "Voting closed" : voted ? "Vote recorded" : "Vote for People's Choice"}</button>
      {error && <p style={{ color: "var(--color-error, #ef4444)", fontSize: "0.8125rem", marginTop: "0.75rem" }}>{error}</p>}
      {open && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
          <div onClick={() => setOpen(false)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.62)", backdropFilter: "blur(4px)" }} />
          <form onSubmit={submitIdentity} className="card" style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 420, padding: "1.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", marginBottom: "1rem" }}><div><div style={{ fontWeight: 800, color: "var(--color-fg)" }}>Cast People&apos;s Choice vote</div><div style={{ fontSize: "0.8125rem", color: "var(--color-muted)" }}>Identity is hashed before storage.</div></div><button type="button" onClick={() => setOpen(false)} className="btn-ghost">×</button></div>
            <label style={{ display: "block", color: "var(--color-fg)", fontWeight: 600, fontSize: "0.875rem", marginBottom: "0.45rem" }}>{config.label}</label>
            <input value={identity} onChange={(e) => setIdentity(e.target.value)} placeholder={config.placeholder} type={identityMethod === "email" ? "email" : "text"} style={{ width: "100%", padding: "0.65rem 0.85rem", borderRadius: 8, border: "1px solid var(--color-border)", background: "var(--color-surface-2)", color: "var(--color-fg)", marginBottom: "0.85rem" }} />
            {identityMethod === "badge" && <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email optional" type="email" style={{ width: "100%", padding: "0.65rem 0.85rem", borderRadius: 8, border: "1px solid var(--color-border)", background: "var(--color-surface-2)", color: "var(--color-fg)", marginBottom: "0.85rem" }} />}
            {error && <p style={{ color: "var(--color-error, #ef4444)", fontSize: "0.8125rem", marginBottom: "0.75rem" }}>{error}</p>}
            <button disabled={submitting} className="btn-primary" style={{ width: "100%", justifyContent: "center" }}>{submitting ? "Submitting..." : "Submit Vote"}</button>
          </form>
        </div>
      )}
    </div>
  );
}
