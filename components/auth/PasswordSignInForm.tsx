"use client";

import { FormEvent, useId, useState } from "react";

export function PasswordSignInForm({
  callbackURL,
  submitVariant = "secondary",
}: {
  callbackURL: string;
  submitVariant?: "primary" | "secondary";
}) {
  const id = useId();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/application-sign-in/password", {
        method: "POST",
        redirect: "manual",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: String(data.get("email") ?? "").trim(),
          password: String(data.get("password") ?? ""),
          callbackURL,
        }),
      });
      if (!response.ok) {
        setError("Unable to sign in with those credentials.");
        return;
      }
      window.location.assign(callbackURL);
    } catch {
      setError("Sign-in is temporarily unavailable.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      className="auth-password-form"
      action="/api/application-sign-in/password"
      method="post"
      onSubmit={submit}
      noValidate
    >
      <input type="hidden" name="callbackURL" value={callbackURL} />
      <div className="auth-password-field">
        <label htmlFor={`${id}-email`}>Email</label>
        <input
          id={`${id}-email`}
          className="input auth-password-input"
          name="email"
          type="email"
          autoComplete="username"
          inputMode="email"
          required
          disabled={pending}
        />
      </div>
      <div className="auth-password-field">
        <label htmlFor={`${id}-password`}>Password</label>
        <input
          id={`${id}-password`}
          className="input auth-password-input"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          minLength={8}
          disabled={pending}
        />
      </div>
      {error && (
        <p className="auth-password-error" role="alert">
          {error}
        </p>
      )}
      <button
        className={submitVariant === "primary" ? "btn-primary" : "btn-secondary"}
        type="submit"
        disabled={pending}
        style={{ width: "100%" }}
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
      <p className="auth-password-help">
        Forgot your password? Use account recovery or contact support.
      </p>
    </form>
  );
}
