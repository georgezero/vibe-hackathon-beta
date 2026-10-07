import { cookies, headers } from "next/headers";
import { NavPublic } from "@/components/NavPublic";
import { PasswordSignInForm } from "@/components/auth/PasswordSignInForm";
import { auth } from "@/lib/auth";
import {
  isRecentLinkingBetterAuthSession,
  preparePendingVibyLink,
  VIBY_LINK_BINDING_COOKIE,
  VIBY_LINK_TOKEN_COOKIE,
} from "@/lib/viby-interactive-linking";

export const dynamic = "force-dynamic";

export default async function LoginLinkVibyPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const reason = (await searchParams).reason;
  const jar = await cookies();
  const token = jar.get(VIBY_LINK_TOKEN_COOKIE)?.value ?? "";
  const binding = jar.get(VIBY_LINK_BINDING_COOKIE)?.value ?? "";
  if (!token || !binding) return <LinkShell title="Link request unavailable">Restart sign-in with Viby to create a new link request.</LinkShell>;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return <LinkShell title="Authenticate your account">
      <p style={{ marginBottom: "1rem" }}>Sign in to the account you want to connect. Accounts are never selected by matching email addresses.</p>
      <PasswordSignInForm callbackURL="/login/link-viby" submitVariant="primary" />
    </LinkShell>;
  }
  if (!isRecentLinkingBetterAuthSession(session.session.createdAt)) {
    return <LinkShell title="Recent authentication required">Sign in again, then restart the Viby sign-in flow before linking.</LinkShell>;
  }
  const pending = await preparePendingVibyLink({
    operation: "application_login",
    token,
    browserBinding: binding,
    userId: session.user.id,
  });
  if (!pending) {
    return <LinkShell title="Link request unavailable">
      This link request expired, was cancelled, or was started for a different account. Restart sign-in with Viby to create a new request.
    </LinkShell>;
  }
  const subjectLabel = `…${pending.vibySubjectHash.slice(-8)}`;
  return <LinkShell title="Link Viby identity">
    <p>You freshly verified an identity with Viby. <strong>{subjectLabel}</strong></p>
    <div className="card" style={{ margin: "1rem 0", padding: "1rem" }}>
      <strong>{session.user.name || "Your account"}</strong>
      <div style={{ color: "var(--color-muted)" }}>{session.user.email}</div>
      <div style={{ color: "var(--color-muted)" }}>Vibe Hackathon · {pending.environment}</div>
    </div>
    <p style={{ marginBottom: "1rem" }}>This connects Viby to this account. It grants no administrator or judge access.</p>
    <form action="/login/link-viby/confirm" method="post"><button className="btn-primary" type="submit" style={{ width: "100%" }}>Link account</button></form>
    <form action="/login/link-viby/cancel" method="post" style={{ marginTop: "0.75rem" }}><button className="btn-secondary" type="submit" style={{ width: "100%" }}>Cancel</button></form>
    {reason === "invalid_transaction" && <p role="alert" style={{ color: "var(--color-error)", marginTop: "0.75rem" }}>This link request expired or is no longer valid.</p>}
  </LinkShell>;
}

function LinkShell({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="min-h-screen"><NavPublic /><main className="mx-auto w-full max-w-[520px] px-4 py-16 sm:px-6"><section className="card" style={{ padding: "1.5rem" }}><h1 style={{ fontFamily: "var(--font-headline)", fontSize: "1.6rem", marginBottom: "0.75rem" }}>{title}</h1><div style={{ color: "var(--color-muted)", lineHeight: 1.6 }}>{children}</div></section></main></div>;
}
