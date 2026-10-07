import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("E2R login failure boundary", () => {
  it("uses a POST-only native form fallback", () => {
    const source = readFileSync("components/auth/PasswordSignInForm.tsx", "utf8");
    expect(source).toContain('action="/api/application-sign-in/password"');
    expect(source).toContain('method="post"');
    expect(source).toContain('redirect: "manual"');
    expect(source).toContain('name="callbackURL"');
  });

  it("keeps native failure redirects on a fixed, non-sensitive reason", () => {
    const source = readFileSync("app/api/application-sign-in/password/route.ts", "utf8");
    expect(source).toContain('reason", "invalid_credentials"');
    expect(source).toContain('"Referrer-Policy": "no-referrer"');
    expect(source).not.toContain("request.nextUrl.origin");
    expect(source).not.toContain("searchParams.set(\"email\"");
    expect(source).not.toContain("searchParams.set(\"password\"");
    expect(source).not.toContain("body.email");
    expect(source).not.toContain("body.password");
  });
});
