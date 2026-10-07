"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const AI_TOOLS = ["Claude", "Cursor", "Codex", "GitHub Copilot", "Hermes", "OpenClaw", "Pi", "Aider", "Devin", "SWE-agent"];

export default function SubmitClient({ eventName }: { eventName?: string }) {
  const router = useRouter();
  const [teamName, setTeamName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState(false);
  const [token, setToken] = useState<string>("");

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!teamName.trim() || !email.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/v1/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamName, contactEmail: email }),
      });
      const data = await res.json();
      if (data.editToken) {
        setToken(data.editToken);
        setCreated(true);
      }
    } finally {
      setLoading(false);
    }
  }

  function goToEdit() {
    router.push(`/submit/${token}`);
  }

  return (
    <div className="mx-auto max-w-xl w-full px-4 sm:px-6 py-16 flex-1">
        {!created ? (
          <>
            <div className="mb-10">
              {eventName && (
                <div style={{ marginBottom: "0.625rem" }}>
                  <span className="badge badge-default">{eventName}</span>
                </div>
              )}
              <div className="flex items-start justify-between gap-4" style={{ marginBottom: "0.5rem" }}>
                <h1
                  style={{
                    fontFamily: "var(--font-headline)",
                    fontSize: "2rem",
                    fontWeight: 700,
                    letterSpacing: "-0.03em",
                    color: "var(--color-fg)",
                  }}
                >
                  Start your submission
                </h1>
                <Link
                  href="/submit/instructions"
                  style={{ fontSize: "0.75rem", color: "var(--color-subtle)", textDecoration: "none", paddingTop: "0.5rem", whiteSpace: "nowrap" }}
                >
                  How to submit →
                </Link>
              </div>
              <p style={{ color: "var(--color-muted)", fontSize: "0.9375rem", lineHeight: 1.6 }}>
                Create a draft now and get a private edit link. You can come back and update your submission any time before the deadline.
              </p>
            </div>

            <form onSubmit={handleCreate} className="flex flex-col gap-5">
              <div>
                <label className="label">Team name *</label>
                <input
                  className="input"
                  type="text"
                  placeholder="e.g. PromptCraft Collective"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="label">Contact email *</label>
                <input
                  className="input"
                  type="email"
                  placeholder="team@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <p style={{ fontSize: "0.75rem", color: "var(--color-subtle)", marginTop: "0.375rem" }}>
                  We&apos;ll send your private edit link to this address.
                </p>
              </div>

              <div className="card" style={{ padding: "1rem" }}>
                <div style={{ fontSize: "0.8125rem", color: "var(--color-muted)", lineHeight: 1.65 }}>
                  <strong style={{ color: "var(--color-fg)" }}>How edit access works:</strong>
                  {" "}After creating your draft, you&apos;ll get a private magic link. Anyone with that link can edit your submission — share it only with your team.
                  GitHub OAuth is available if you ever lose the link.
                </div>
              </div>

              <button
                type="submit"
                className="btn-primary"
                disabled={loading || !teamName.trim() || !email.trim()}
                style={{ justifyContent: "center", padding: "0.75rem" }}
              >
                {loading ? "Creating draft…" : "Create draft →"}
              </button>
            </form>
          </>
        ) : (
          <div className="text-center">
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                background: "color-mix(in srgb, var(--color-success) 15%, transparent)",
                border: "2px solid var(--color-success)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 1.5rem",
                fontSize: "1.5rem",
              }}
            >
              ✓
            </div>
            <h2
              style={{
                fontFamily: "var(--font-headline)",
                fontSize: "1.75rem",
                fontWeight: 700,
                color: "var(--color-fg)",
                marginBottom: "0.75rem",
                letterSpacing: "-0.03em",
              }}
            >
              Draft created!
            </h2>
            <p style={{ color: "var(--color-muted)", marginBottom: "1.5rem", lineHeight: 1.65 }}>
              Your private edit link has been generated. Save it — anyone with this link can edit your submission.
            </p>

            <div
              className="card"
              style={{ padding: "1rem", marginBottom: "1.5rem", fontFamily: "var(--font-mono)", fontSize: "0.8125rem", wordBreak: "break-all", color: "var(--color-accent)", textAlign: "left" }}
            >
              {typeof window !== "undefined" ? window.location.origin : "https://vibehackathon.com"}/submit/{token}
            </div>

            <div className="flex flex-col gap-3">
              <button onClick={goToEdit} className="btn-primary" style={{ justifyContent: "center" }}>
                Fill out your submission →
              </button>
              <button
                onClick={() => {
                  if (typeof navigator !== "undefined") {
                    navigator.clipboard.writeText(`${window.location.origin}/submit/${token}`);
                  }
                }}
                className="btn-secondary"
                style={{ justifyContent: "center" }}
              >
                Copy edit link
              </button>
            </div>
          </div>
        )}
    </div>
  );
}
