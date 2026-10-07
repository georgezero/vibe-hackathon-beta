import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Nav } from "@/components/Nav";
import { resolveApplicationPrincipal } from "@/lib/application-principal";
import { applicationHeaderAccount } from "@/lib/application-account-display";

export const dynamic = "force-dynamic";

export default async function AdminEntryPage() {
  const resolution = await resolveApplicationPrincipal(await headers());
  if (resolution.status === "unauthenticated") {
    redirect("/login?returnTo=/admin/dashboard");
  }
  if (resolution.status === "authenticated" && resolution.principal.roles.isAdmin) {
    redirect("/admin/dashboard");
  }
  const account = resolution.status === "authenticated"
    ? applicationHeaderAccount({
      display_name: resolution.principal.user.name?.trim() || resolution.principal.user.email,
      roles: resolution.principal.roles,
    })
    : null;
  return (
    <div className="min-h-screen">
      <Nav authenticatedAccount={account} />
      <main className="mx-auto w-full max-w-2xl px-4 py-16 sm:px-6">
        <section className="card" style={{ padding: "1.5rem" }}>
          <h1 style={{ fontFamily: "var(--font-headline)", fontSize: "1.6rem", marginBottom: "0.6rem" }}>Administrator access</h1>
          <p style={{ color: "var(--color-muted)", lineHeight: 1.6, marginBottom: "1rem" }}>
            The current account does not have administrator access.
          </p>
          <a className="btn-primary" href="/login?returnTo=%2Fadmin%2Fdashboard&reason=not_authorized">Use another account</a>
        </section>
      </main>
    </div>
  );
}
