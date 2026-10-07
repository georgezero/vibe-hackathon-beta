import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const root = process.cwd();

describe("password administrator foundation", () => {
  it("uses Better Auth's supported email/password and session APIs", () => {
    const auth = readFileSync(join(root, "lib/auth.ts"), "utf8");
    const login = [
      readFileSync(join(root, "components/auth/PasswordSignInForm.tsx"), "utf8"),
      readFileSync(join(root, "app/api/application-sign-in/password/route.ts"), "utf8"),
    ].join("\n");
    const principal = readFileSync(join(root, "lib/admin-principal.ts"), "utf8");
    const applicationPrincipal = readFileSync(
      join(root, "lib/application-principal.ts"),
      "utf8",
    );
    const logout = [
      readFileSync(join(root, "app/logout/route.ts"), "utf8"),
      readFileSync(join(root, "lib/application-logout.ts"), "utf8"),
    ].join("\n");
    expect(auth).toContain("emailAndPassword:");
    expect(auth).toContain("disableSignUp: true");
    expect(auth).toContain("minPasswordLength: 8");
    expect(login).toContain("auth.api.signInEmail");
    expect(login).toContain("current.session.id");
    expect(principal).toContain("resolveApplicationPrincipal(headers)");
    expect(applicationPrincipal).toContain("auth.api.getSession");
    expect(applicationPrincipal).toContain('"better_auth_session"');
    expect(principal).not.toContain('identity_method: "email_password"');
    expect(logout).toContain("auth.api.signOut");
    expect(principal).not.toContain("createSessionForUser");
  });

  it("keeps authorization application-owned and database-unique", () => {
    const schema = readFileSync(join(root, "lib/db/schema.ts"), "utf8");
    expect(schema).toContain('sqliteTable("admin_authorizations"');
    expect(schema).toContain('uniqueIndex("admin_authorizations_user_unique")');
    expect(schema).toContain('status: text("status", { enum: ["active", "revoked"] })');
  });

  it("does not convert provenance callbacks to Better Auth sessions", () => {
    for (const route of ["agent-callback", "artifact-callback"]) {
      const source = readFileSync(join(root, `app/admin/viby/${route}/route.ts`), "utf8");
      expect(source).not.toContain("signIn.email");
      expect(source).not.toContain("createAdminSessionCookie");
    }
  });
});
