import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { NavPublic } from "@/components/NavPublic";
import { AuthenticationIntro } from "@/components/auth/AuthenticationIntro";
import { InteractiveSignInCard } from "@/components/auth/InteractiveSignInCard";
import { resolveApplicationPrincipal } from "@/lib/application-principal";
import { landingForPrincipal, loginContext, safeLoginReturnTo } from "@/lib/login-routing";
import { currentJudgingEventId } from "@/lib/judging-event";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string; reason?: string }>;
}) {
  const query = await searchParams;
  const returnTo = safeLoginReturnTo(query.returnTo);
  const resolution = await resolveApplicationPrincipal(await headers(), {
    eventId: currentJudgingEventId(),
  });
  const authenticated = resolution.status === "authenticated";
  const targetAuthorized = authenticated && (
    returnTo === null
      || returnTo === "/login"
      || (returnTo.startsWith("/admin") && resolution.principal.roles.isAdmin)
      || (returnTo.startsWith("/judge") && resolution.principal.roles.isJudge)
      || returnTo.startsWith("/account")
      || returnTo === "/claim/confirm"
      || returnTo === "/projects/join"
      || returnTo.startsWith("/projects/join/")
  );

  if (authenticated && targetAuthorized) {
    if (resolution.principal.account.passwordChangeRequired) {
      redirect("/account?password=required");
    }
    redirect(landingForPrincipal(resolution.principal, returnTo));
  }

  const callbackURL = returnTo
    ? `/login?returnTo=${encodeURIComponent(returnTo)}`
    : "/login";
  const contextual = loginContext(returnTo);
  return (
    <div className="min-h-screen">
      <NavPublic />
      <main className="mx-auto flex min-h-[calc(100vh-8rem)] w-full max-w-3xl items-center justify-center px-4 py-16 sm:px-6">
        <div className="w-full max-w-[520px]">
          <AuthenticationIntro
            title="Sign in"
            description="Sign in with Viby or your email and password."
          />
          {contextual && (
            <div
              role="status"
              style={{
                border: "1px solid var(--color-border)",
                background: "var(--color-surface-2)",
                borderRadius: 12,
                padding: "0.75rem 0.9rem",
                marginBottom: "1rem",
                color: "var(--color-muted)",
                fontSize: "0.84rem",
                lineHeight: 1.5,
              }}
            >
              {contextual}
              {authenticated && " The current account is not authorized for this destination."}
            </div>
          )}
          {query.reason === "not_authorized" && !contextual && (
            <div role="status" className="card" style={{ padding: "0.85rem 1rem", marginBottom: "1rem", color: "var(--color-muted)", fontSize: "0.84rem" }}>
              The current account is not authorized for that destination.
            </div>
          )}
          {query.reason === "invalid_credentials" && (
            <div role="alert" className="card" style={{ padding: "0.85rem 1rem", marginBottom: "1rem", color: "var(--color-error)", fontSize: "0.84rem" }}>
              Unable to sign in with those credentials.
            </div>
          )}
          <InteractiveSignInCard
            flow="application"
            callbackURL={callbackURL}
            returnTo={returnTo ?? undefined}
            replacingAccount={authenticated}
          />
        </div>
      </main>
    </div>
  );
}
