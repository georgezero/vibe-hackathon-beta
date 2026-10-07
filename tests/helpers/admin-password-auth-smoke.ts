export {};

async function main() {
const { auth } = await import("../../lib/auth");

async function signIn(password: string) {
  return auth.handler(new Request("http://127.0.0.1:3000/api/auth/sign-in/email", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://127.0.0.1:3000",
    },
    body: JSON.stringify({ email: "admin@example.test", password }),
  }));
}

const invalid = await signIn("incorrect-password-value");
const valid = await signIn("a-long-test-password-123");
const cookie = valid.headers.get("set-cookie") ?? "";
const session = await auth.api.getSession({ headers: new Headers({ cookie }) });
const { resolveAdminPrincipal } = await import("../../lib/admin-principal");
const { encodeAdminSession } = await import("../../lib/admin-session");
const authorized = await resolveAdminPrincipal(new Headers({ cookie }));
const vibyCookie = encodeAdminSession({
  viby_user_id: "test-viby-admin",
  display_name: "Test Viby Admin",
  role: "admin",
  issued_at: Date.now(),
  expires_at: Date.now() + 60_000,
  identity_method: "face_identify",
  identity_confidence: 1,
});
const conflict = await resolveAdminPrincipal(new Headers({
  cookie: `${cookie}; vibe_admin_session=${encodeURIComponent(vibyCookie)}`,
}));
const { db } = await import("../../lib/db");
const { adminAuthorizations, sessions } = await import("../../lib/db/schema");
const { eq } = await import("drizzle-orm");
await db.update(adminAuthorizations)
  .set({ status: "revoked", revokedAt: new Date(), updatedAt: new Date() })
  .where(eq(adminAuthorizations.userId, session!.user.id));
const revoked = await resolveAdminPrincipal(new Headers({ cookie }));
await db.update(adminAuthorizations)
  .set({ status: "active", revokedAt: null, updatedAt: new Date() })
  .where(eq(adminAuthorizations.userId, session!.user.id));
const sessionsBeforeSignOut = await db.select({ id: sessions.id })
  .from(sessions)
  .where(eq(sessions.userId, session!.user.id));
const signedOut = await auth.api.signOut({
  headers: new Headers({ cookie }),
  asResponse: true,
});
const sessionsAfterSignOut = await db.select({ id: sessions.id })
  .from(sessions)
  .where(eq(sessions.userId, session!.user.id));
const sessionAfterSignOut = await auth.api.getSession({
  headers: new Headers({ cookie }),
});
console.log(JSON.stringify({
  invalidStatus: invalid.status,
  validStatus: valid.status,
  hasCookie: cookie.includes("better-auth."),
  sessionUser: session?.user.email,
  authorizedStatus: authorized.status,
  authorizedIdentityMethod: authorized.status === "authorized"
    ? authorized.principal.identity_method
    : null,
  conflictStatus: conflict.status,
  conflictReason: conflict.status === "forbidden" ? conflict.reason : null,
  revokedStatus: revoked.status,
  signOutStatus: signedOut.status,
  clearsCookie: signedOut.headers.get("set-cookie")?.includes("Max-Age=0") ?? false,
  sessionsBeforeSignOut: sessionsBeforeSignOut.length,
  sessionsAfterSignOut: sessionsAfterSignOut.length,
  sessionAfterSignOut: sessionAfterSignOut === null,
}));
}

main().catch(() => {
  process.exitCode = 1;
});
