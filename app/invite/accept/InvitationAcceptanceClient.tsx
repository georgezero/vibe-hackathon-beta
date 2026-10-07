"use client";

import { FormEvent, useState } from "react";
import { authClient } from "@/lib/auth-client";

export default function InvitationAcceptanceClient({
  name,
  email,
  expiresAt,
  administratorAccess,
  judgeAccess,
}: {
  name: string;
  email: string;
  expiresAt: string;
  administratorAccess: boolean;
  judgeAccess: boolean;
}) {
  const [mode, setMode] = useState<"choice" | "password">("choice");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    if (password !== String(form.get("confirmation") ?? "")) {
      setError("The passwords do not match.");
      return;
    }
    setPending(true);
    setError(null);
    const response = await fetch("/api/invitations/accept/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const body = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) {
      setError(body.error ?? "The invitation could not be accepted.");
      setPending(false);
      return;
    }
    const signedIn = await authClient.signIn.email({ email, password, callbackURL: "/account" });
    if (signedIn.error) {
      setError("Your account is ready. Sign in with the password you just created.");
      setPending(false);
      return;
    }
    window.location.assign("/account");
  }

  return (
    <section className="invitation-panel">
      <header className="invitation-header">
        <span className="invitation-mark" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6 5.6 18.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg></span>
        <div>
          <h1>Welcome, {name}</h1>
          <p>Choose how you would like to sign in. Your access comes from this invitation, not from the sign-in method you choose.</p>
        </div>
      </header>
      <div className="invitation-summary">
        <div><span>Account</span><strong>{email}</strong></div>
        <div><span>Access</span><strong>{[administratorAccess && "Administrator", judgeAccess && "Judge"].filter(Boolean).join(" · ") || "Authenticated user"}</strong></div>
        <div><span>Expires</span><strong>{new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(expiresAt))}</strong></div>
      </div>
      {mode === "choice" ? (
        <div className="invitation-choices">
          <form action="/api/invitations/accept/viby" method="post">
            <button className="btn-primary" type="submit">Continue with Viby</button>
          </form>
          <button className="btn-secondary" type="button" onClick={() => setMode("password")}>Create a password</button>
          <p>Viby confirmation links your verified identity to this account. It does not add access beyond the invitation.</p>
        </div>
      ) : (
        <form className="invitation-password-form" onSubmit={createPassword}>
          <div className="invitation-form-heading">
            <h2>Create your password</h2>
            <button className="btn-ghost" type="button" onClick={() => { setMode("choice"); setError(null); }}>Back</button>
          </div>
          <label><span>Password</span><input className="input" name="password" type="password" minLength={8} maxLength={128} autoComplete="new-password" required autoFocus /></label>
          <label><span>Confirm password</span><input className="input" name="confirmation" type="password" minLength={8} maxLength={128} autoComplete="new-password" required /></label>
          <p className="invitation-help">Use 8–128 characters. Your password is handled by the sign-in service and is never visible to administrators.</p>
          {error && <p className="invitation-error" role="alert">{error}</p>}
          <button className="btn-primary" type="submit" disabled={pending}>{pending ? "Creating account…" : "Create account"}</button>
        </form>
      )}
    </section>
  );
}
