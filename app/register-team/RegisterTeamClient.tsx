"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";

interface Props {
  githubLogin: string | null;
  githubEmail: string;
  githubRequired: boolean;
}

type Teammate = { name: string; email: string; badgeNumber: string; affiliation: string; degrees: string; isStudentTrainee: boolean };

export function RegisterTeamClient({ githubLogin, githubEmail, githubRequired }: Props) {
  const router = useRouter();
  const [teamName, setTeamName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [contactEmail, setContactEmail] = useState(githubEmail);
  const [ownerBadgeNumber, setOwnerBadgeNumber] = useState("");
  const [teammates] = useState<Teammate[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/register-team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamName, ownerName, contactEmail, ownerBadgeNumber, teammates }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Registration failed");
        return;
      }
      router.push(data.start_url ? new URL(data.start_url).pathname : `/submit/${data.editToken}/start`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      {githubLogin ? (
        <div className="card" style={{ padding: "1rem" }}>
          <div className="badge badge-success" style={{ marginBottom: "0.5rem" }}>Team lead</div>
          <div style={{ color: "var(--color-fg)", fontWeight: 800 }}>@{githubLogin}</div>
          <div style={{ color: "var(--color-muted)", fontSize: "0.8125rem" }}>{githubEmail}</div>
          <p style={{ color: "var(--color-subtle)", fontSize: "0.75rem", marginTop: "0.75rem", lineHeight: 1.5 }}>
            This account will manage the project. Teammates can be added after the private project is created.
          </p>
        </div>
      ) : (
        <div className="card" style={{ padding: "1rem" }}>
          <div className="badge badge-warning" style={{ marginBottom: "0.5rem" }}>Team lead</div>
          <div style={{ color: "var(--color-fg)", fontWeight: 800 }}>Team lead details</div>
          <p style={{ color: "var(--color-subtle)", fontSize: "0.75rem", marginTop: "0.75rem", lineHeight: 1.5 }}>
            Your email and badge number verify event participation and help recover this project. GitHub login is not required for this event.
          </p>
        </div>
      )}

      <Field label="Team name *"><input className="input" value={teamName} onChange={(e) => setTeamName(e.target.value)} required /></Field>
      <Field label="Team lead name *"><input className="input" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} required /></Field>
      <Field label="Contact email *"><input className="input" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} required /></Field>
      <div><Field label="Badge number *"><input id="register-owner-badge" className="input" value={ownerBadgeNumber} onChange={(e) => setOwnerBadgeNumber(e.target.value)} required aria-describedby="register-badge-help" /></Field><p id="register-badge-help" style={{ color: "var(--color-subtle)", fontSize: "0.75rem", lineHeight: 1.5, marginTop: "-0.7rem" }}>Used to verify event participation and prize eligibility.</p></div>

      <div className="card" style={{ padding: "1rem", color: "var(--color-muted)", fontSize: "0.8125rem", lineHeight: 1.6 }}>
        This creates a private project draft first. Next you can fill out the form or use a coding agent. You can add teammates after the draft is ready.
      </div>

      {error && <div className="badge badge-error">{error}</div>}
      <button type="submit" disabled={loading || !teamName || !ownerName || !contactEmail || !ownerBadgeNumber || (githubRequired && !githubLogin)} className="btn-primary" style={{ justifyContent: "center", padding: "0.75rem" }}>
        {loading ? "Creating project…" : "Create project"}
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div><label className="label">{label}</label>{children}</div>;
}
