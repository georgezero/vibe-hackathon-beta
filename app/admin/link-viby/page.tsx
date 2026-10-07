import { cookies, headers } from "next/headers";
import { Nav } from "@/components/Nav";
import { GitHubSignInButton } from "@/components/GitHubSignInButton";
import { auth } from "@/lib/auth";
import {
  isRecentLinkingBetterAuthSession,
  preparePendingVibyLink,
  VIBY_LINK_BINDING_COOKIE,
  VIBY_LINK_TOKEN_COOKIE,
} from "@/lib/viby-interactive-linking";
import { PasswordSignInForm } from "@/components/auth/PasswordSignInForm";

export const dynamic = "force-dynamic";

export default async function LinkVibyPage({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const reason = (await searchParams).reason;
  if (reason === "revoked_link") return <LinkShell title="Link previously disconnected">This identity was previously disconnected. Contact an administrator to restore the link.</LinkShell>;
  if (reason === "subject_conflict" || reason === "user_conflict" || reason === "ambiguous_link" || reason === "legacy_row_changed" || reason === "concurrent_claim_lost") return <LinkShell title="Account link conflict">This identity or account cannot be linked safely. Contact an administrator; links are never transferred automatically.</LinkShell>;
  const cookieStore = await cookies();
  const requestHeaders = await headers();
  const token = cookieStore.get(VIBY_LINK_TOKEN_COOKIE)?.value ?? "";
  const binding = cookieStore.get(VIBY_LINK_BINDING_COOKIE)?.value ?? "";
  if (!token || !binding) return <LinkShell title="Link request unavailable">Restart sign-in with Viby to create a new link request.</LinkShell>;

  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session?.user?.id) {
    return (
      <LinkShell title="Authenticate your account">
        <p style={{ marginBottom: "1rem" }}>Sign in to the account you want to connect. For your security, accounts are never selected by matching email addresses.</p>
        <PasswordSignInForm callbackURL="/admin/link-viby" submitVariant="primary" />
        <div aria-hidden="true" style={{ textAlign: "center", margin: "1rem 0", color: "var(--color-muted)" }}>OR</div>
        <GitHubSignInButton callbackURL="/admin/link-viby" />
      </LinkShell>
    );
  }
  if (!isRecentLinkingBetterAuthSession(session.session.createdAt)) {
    return <LinkShell title="Recent authentication required">Sign out, restart the Viby flow, and authenticate this account again before linking.</LinkShell>;
  }
  const pending = await preparePendingVibyLink({ token, browserBinding: binding, userId: session.user.id });
  if (!pending) return <LinkShell title="Link request expired">This request is invalid, expired, already used, or belongs to a different browser.</LinkShell>;
  const subjectLabel = `…${pending.vibySubjectHash.slice(-8)}`;
  const isLegacyClaim = pending.transactionType === "claim_unbound_legacy_link";
  return (
    <LinkShell title={isLegacyClaim ? "Connect existing Viby identity" : "Link Viby identity"}>
      <p>
        {isLegacyClaim
          ? "You verified an existing Viby identity that has not yet been connected to a sign-in account."
          : "You verified a new identity with Viby."}
        {" "}<strong>{subjectLabel}</strong>
      </p>
      <div className="card" style={{ margin: "1rem 0", padding: "1rem" }}>
        <strong>{session.user.name || "Your account"}</strong>
        <div style={{ color: "var(--color-muted)" }}>{session.user.email}</div>
        <div style={{ color: "var(--color-muted)" }}>Vibe Hackathon · {pending.environment}</div>
      </div>
      <p style={{ marginBottom: "1rem" }}>This connects the identity to this account. It does not grant administrator access.</p>
      <form action="/admin/link-viby/confirm" method="post">
        <button className="btn-primary" type="submit" style={{ width: "100%" }}>{isLegacyClaim ? "Connect account" : "Link account"}</button>
      </form>
      <form action="/admin/link-viby/cancel" method="post" style={{ marginTop: "0.75rem" }}>
        <button className="btn-secondary" type="submit" style={{ width: "100%" }}>Cancel</button>
      </form>
    </LinkShell>
  );
}

function LinkShell({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="min-h-screen"><Nav /><main style={{ maxWidth: 520, margin: "4rem auto", padding: "1rem" }}><div className="card" style={{ padding: "1.5rem" }}><h1 style={{ fontFamily: "var(--font-headline)", fontSize: "1.6rem", marginBottom: "0.75rem" }}>{title}</h1><div style={{ color: "var(--color-muted)", lineHeight: 1.6 }}>{children}</div></div></main></div>;
}
