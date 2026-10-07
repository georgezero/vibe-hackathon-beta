"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * The account handoff is deliberately optional. A draft remains usable with
 * its private recovery details when a participant chooses to continue as a
 * guest.
 */
export function SaveProjectCard({
  submissionId,
  editToken,
  compact = false,
}: {
  submissionId: string;
  editToken: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function saveToAccount() {
    setPending(true);
    setError("");
    const response = await fetch("/api/submissions/claim/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ submissionId, editToken }),
    });
    const body = await response.json().catch(() => ({})) as { next?: string; error?: string };
    setPending(false);
    if (!response.ok) {
      setError(body.error ?? "This project could not be saved to your account.");
      return;
    }
    router.push(body.next === "/claim/confirm" ? body.next : "/login?returnTo=%2Fclaim%2Fconfirm");
  }

  return (
    <section className="card save-project-card" style={{ padding: compact ? "1rem" : "1.25rem" }}>
      <div className="save-project-card-inner flex items-start justify-between gap-4 flex-wrap">
        <div style={{ minWidth: 0, flex: 1 }}>
          <h2 style={{ color: "var(--color-fg)", fontWeight: 850, fontSize: compact ? "1rem" : "1.15rem" }}>
            Save this project to My Projects
          </h2>
          <p style={{ color: "var(--color-muted)", fontSize: "0.84rem", lineHeight: 1.6, marginTop: "0.4rem" }}>
            Save your project, collaborate with your team, and return from any device.
          </p>
          {!compact && (
            <p style={{ color: "var(--color-subtle)", fontSize: "0.76rem", lineHeight: 1.55, marginTop: "0.55rem" }}>
              You can keep working without an account. Saving is optional and does not submit the project.
            </p>
          )}
        </div>
        <button className="btn-primary" type="button" disabled={pending} onClick={saveToAccount}>
          {pending ? "Opening account…" : "Save to My Projects"}
        </button>
      </div>
      {error && <p role="alert" className="badge badge-error" style={{ marginTop: "0.75rem" }}>{error}</p>}
    </section>
  );
}
