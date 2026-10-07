"use client";

import { type FormEvent, useState } from "react";

export function AdminDevFallbackForm({ devToken }: { devToken: string }) {
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submitFallback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const form = new FormData();
      form.set("token", token);
      const response = await fetch("/admin/dev-login", {
        method: "POST",
        body: form,
        headers: {
          Accept: "application/json",
        },
      });
      const payload = await response.json().catch(() => null) as { ok?: boolean; message?: string } | null;

      if (!response.ok || !payload?.ok) {
        setError(payload?.message ?? "Development fallback failed.");
        setSubmitting(false);
        return;
      }

      window.location.assign("/admin/dashboard");
    } catch {
      setError("Development fallback failed.");
      setSubmitting(false);
    }
  }

  return (
    <details className="card" style={{ padding: "1rem", borderColor: "color-mix(in srgb, var(--color-warning) 45%, var(--color-border))" }}>
      <summary
        style={{
          cursor: "pointer",
          color: "var(--color-fg)",
          fontWeight: 800,
          fontSize: "0.875rem",
        }}
      >
        Development fallback
      </summary>
      <div style={{ paddingTop: "0.875rem" }}>
        <div className="badge badge-warning" style={{ marginBottom: "0.75rem" }}>
          Local admin token fallback
        </div>
        <p style={{ color: "var(--color-muted)", fontSize: "0.8125rem", lineHeight: 1.6, marginBottom: "1rem" }}>
          This bypasses Viby and should stay disabled outside local development.
        </p>
      <button
        type="button"
        onClick={() => setToken(devToken)}
        className="btn-ghost"
        style={{
          width: "100%",
          justifyContent: "flex-start",
          border: "1px solid color-mix(in srgb, var(--color-warning) 55%, transparent)",
          marginBottom: "1rem",
        }}
        aria-label="Use development admin token"
      >
        <span style={{ display: "grid", gap: "0.25rem" }}>
          <span style={{ color: "var(--color-warning)", fontSize: "0.6875rem", fontWeight: 800, letterSpacing: "0.08em" }}>
            DEV TOKEN
          </span>
          <span style={{ fontFamily: "var(--font-mono)", color: "var(--color-accent)", fontSize: "0.8125rem" }}>
            {devToken}
          </span>
        </span>
      </button>
      <form action="/admin/dev-login" method="post" className="flex flex-col gap-3" onSubmit={submitFallback}>
        <input
          className="input"
          type="password"
          name="token"
          placeholder="Admin token"
          autoComplete="off"
          value={token}
          onChange={(event) => setToken(event.target.value)}
        />
        {error && (
          <p style={{ color: "var(--color-danger)", fontSize: "0.8125rem", margin: 0 }}>
            {error}
          </p>
        )}
        <button type="submit" className="btn-secondary" style={{ justifyContent: "center" }}>
          {submitting ? "Entering..." : "Enter with development fallback"}
        </button>
      </form>
      </div>
    </details>
  );
}
