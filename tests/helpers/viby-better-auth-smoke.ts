export {};

async function main() {
  const { auth } = await import("../../lib/auth");
  const complete = await auth.handler(new Request("http://127.0.0.1:3000/api/auth/viby/complete", {
    headers: {
      cookie: `vibe_viby_session_handoff=${process.env.TEST_VIBY_HANDOFF}`,
      origin: "http://127.0.0.1:3000",
      "user-agent": "vibe-phase-b-compatibility-test",
      "x-forwarded-for": "192.0.2.10",
    },
    redirect: "manual",
  }));
  const cookie = complete.headers.get("set-cookie") ?? "";
  const session = await auth.api.getSession({ headers: new Headers({ cookie }) });
  const { resolveAdminPrincipal } = await import("../../lib/admin-principal");
  const principal = await resolveAdminPrincipal(new Headers({ cookie }));
  const { db } = await import("../../lib/db");
  const { adminSessionProvenance, vibyIdentityLinks } = await import("../../lib/db/schema");
  const { eq } = await import("drizzle-orm");
  const provenance = await db.select().from(adminSessionProvenance);
  await db.update(vibyIdentityLinks)
    .set({ status: "revoked", revokedAt: new Date(), updatedAt: new Date() })
    .where(eq(vibyIdentityLinks.id, "link-1"));
  const revokedLinkPrincipal = await resolveAdminPrincipal(new Headers({ cookie }));
  const signedOut = await auth.api.signOut({ headers: new Headers({ cookie }), asResponse: true });
  console.log(JSON.stringify({
    completeStatus: complete.status,
    location: complete.headers.get("location"),
    hasBetterAuthCookie: cookie.includes("better-auth."),
    clearsLegacyCookie: cookie.includes("vibe_admin_session="),
    sessionUserId: session?.user.id,
    principalStatus: principal.status,
    identityMethod: principal.status === "authorized" ? principal.principal.identity_method : null,
    provenanceCountBeforeLogout: provenance.length,
    sessionIpAddress: session?.session.ipAddress,
    sessionUserAgent: session?.session.userAgent,
    revokedLinkStatus: revokedLinkPrincipal.status,
    signOutStatus: signedOut.status,
    signOutClearsCookie: signedOut.headers.get("set-cookie")?.includes("Max-Age=0") ?? false,
  }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "compatibility test failed");
  process.exitCode = 1;
});
