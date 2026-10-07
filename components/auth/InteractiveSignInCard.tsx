import { PasswordSignInForm } from "./PasswordSignInForm";

export function InteractiveSignInCard({
  flow,
  callbackURL,
  returnTo,
  replacingAccount = false,
}: {
  flow: "application" | "admin" | "judge";
  callbackURL: string;
  returnTo?: string;
  replacingAccount?: boolean;
}) {
  return (
    <div className="card" style={{ padding: "1.25rem", marginBottom: "1rem" }}>
      <p style={{ color: "var(--color-muted)", fontSize: "0.875rem", lineHeight: 1.6, marginBottom: "1rem" }}>
        Continue with Viby, or use your email and password.
      </p>
      <form action="/api/viby/start" method="post">
        <input type="hidden" name="flow" value={flow} />
        {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
        <button className="btn-primary" type="submit" style={{ width: "100%" }}>
          Continue with Viby
        </button>
      </form>
      {replacingAccount && (
        <p style={{ color: "var(--color-muted)", fontSize: "0.72rem", lineHeight: 1.5, textAlign: "center", marginTop: "0.65rem" }}>
          Continuing with Viby will sign out the current account.
        </p>
      )}
      <div aria-hidden="true" style={{ display: "flex", alignItems: "center", gap: "0.75rem", margin: "1.35rem 0 1.15rem", color: "var(--color-muted)", fontSize: "0.7rem", fontWeight: 800 }}>
        <span style={{ height: 1, background: "var(--color-border)", flex: 1 }} />
        OR
        <span style={{ height: 1, background: "var(--color-border)", flex: 1 }} />
      </div>
      <PasswordSignInForm callbackURL={callbackURL} />
    </div>
  );
}
