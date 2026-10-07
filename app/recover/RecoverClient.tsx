"use client";

import { useState } from "react";

interface OwnedSubmission {
  id: string;
  teamName: string;
  projectTitle: string | null;
  editUrl: string;
  previewUrl: string;
  manageTeamUrl?: string;
  teamSize?: number;
  badgeCount?: number;
  eligibleForPrize?: boolean;
}

export function RecoverClient({ submissions, badgeMode = false }: { submissions: OwnedSubmission[]; badgeMode?: boolean }) {
  const [rows, setRows] = useState(submissions);
  const [contactEmail, setContactEmail] = useState("");
  const [ownerBadgeNumber, setOwnerBadgeNumber] = useState("");
  const [error, setError] = useState("");

  async function regenerate(id: string) {
    const res = await fetch("/api/recover/regenerate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ submissionId: id }),
    });
    const data = await res.json();
    if (!res.ok) return;
    setRows((current) => current.map((row) => row.id === id ? { ...row, editUrl: data.edit_url, previewUrl: data.preview_url, manageTeamUrl: data.start_url ? data.start_url.replace("/start", "/team") : row.manageTeamUrl } : row));
  }

  async function recoverByBadge(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/recover/badge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactEmail, ownerBadgeNumber }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "We could not find a project with those details.");
      setRows([]);
      return;
    }
    setRows(data.submissions ?? []);
  }

  return (
    <div className="flex flex-col gap-3">
      {badgeMode && (
        <form onSubmit={recoverByBadge} className="card" style={{ padding: "1.25rem", marginBottom: "0.5rem" }}>
          <h2 style={{ color: "var(--color-fg)", fontWeight: 800, marginBottom: "0.75rem" }}>Find a project</h2>
          <p style={{ color: "var(--color-muted)", fontSize: "0.875rem", lineHeight: 1.6, marginBottom: "1rem" }}>
            Enter the contact email and team lead badge number used during project creation.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input className="input" type="email" placeholder="Contact email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} required />
            <input className="input" placeholder="Team lead badge number" value={ownerBadgeNumber} onChange={(e) => setOwnerBadgeNumber(e.target.value)} required />
          </div>
          {error && <div className="badge badge-error" style={{ marginTop: "0.75rem" }}>{error}</div>}
          <button type="submit" className="btn-primary" style={{ marginTop: "1rem" }}>Find projects</button>
        </form>
      )}
      {rows.map((sub) => (
        <div key={sub.id} className="card" style={{ padding: "1.25rem" }}>
          <div style={{ fontWeight: 800, color: "var(--color-fg)", marginBottom: "0.25rem" }}>{sub.projectTitle ?? sub.teamName}</div>
          <div style={{ color: "var(--color-muted)", fontSize: "0.8125rem", marginBottom: "1rem" }}>{sub.teamName}</div>
          {sub.teamSize !== undefined && (
            <div className="flex flex-wrap gap-2" style={{ marginBottom: "1rem" }}>
              <span className="badge badge-default">Team size {sub.teamSize}/6</span>
              <span className={sub.eligibleForPrize ? "badge badge-success" : "badge badge-warning"}>Badge details {sub.badgeCount ?? 0}/{sub.teamSize}</span>
              <span className={sub.eligibleForPrize ? "badge badge-success" : "badge badge-warning"}>{sub.eligibleForPrize ? "Prize eligible" : "Prize incomplete"}</span>
            </div>
          )}
          <div className="flex gap-2 flex-wrap">
            <a href={sub.editUrl} className="btn-secondary">Edit</a>
            <a href={sub.previewUrl} className="btn-primary">Preview</a>
            {sub.manageTeamUrl && <a href={sub.manageTeamUrl} className="btn-secondary">Edit team</a>}
            <button type="button" className="btn-ghost" onClick={() => regenerate(sub.id)}>Create new private link</button>
          </div>
        </div>
      ))}
    </div>
  );
}
