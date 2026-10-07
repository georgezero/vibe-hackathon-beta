import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const source = (path: string) => readFileSync(join(root, path), "utf8");

describe("B.4.1 application-principal boundaries", () => {
  it("delegates Better Auth administrator resolution to the shared principal", () => {
    const admin = source("lib/admin-principal.ts");
    const application = source("lib/application-principal.ts");
    expect(admin).toContain("resolveApplicationPrincipal(headers)");
    expect(admin).not.toContain("adminAuthorizations");
    expect(application).toContain("resolveLiveAdminAuthorization");
    expect(application).toContain("auth.api.getSession");
  });

  it("contains historical provenance storage naming behind a role-neutral API", () => {
    const repository = source("lib/interactive-session-provenance.ts");
    const principal = source("lib/application-principal.ts");
    expect(repository).toContain("adminSessionProvenance");
    expect(repository).toContain("getInteractiveSessionProvenance");
    expect(repository).toContain("recordInteractiveSessionProvenance");
    expect(principal).not.toContain("adminSessionProvenance");
  });

  it("keeps retired judge credentials outside the shared resolver", () => {
    const application = source("lib/application-principal.ts");
    expect(application).not.toContain("vibe_judge_session");
    expect(application).not.toContain("judge-session");
    expect(application).not.toContain("judges");
  });

  it("uses role-neutral global account-control names without changing its UI", () => {
    const nav = source("components/Nav.tsx");
    const publicNav = source("components/NavPublic.tsx");
    expect(nav).toContain("authenticatedAccount");
    expect(publicNav).toContain("authenticatedAccount");
    expect(nav).not.toContain("adminAccount");
    expect(publicNav).not.toContain("adminAccount");
    expect(nav).toContain("{authenticatedAccount.displayName}");
    expect(nav).toContain("Log out");
    expect(nav).not.toContain("Confirmed with Viby");
  });

  it("has no executable legacy judge authentication stack", () => {
    expect(() => source("lib/judge-session.ts")).toThrow();
    expect(() => source("lib/judge-auth-mode.ts")).toThrow();
    expect(() => source("app/api/judge/session/route.ts")).toThrow();
    expect(() => source("app/api/judge/logout/route.ts")).toThrow();
  });
});
