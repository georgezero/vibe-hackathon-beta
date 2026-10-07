import { describe, expect, it, vi } from "vitest";
import { issueVibyCallbackState } from "../lib/viby-callback-state";

describe("Viby callback state contract", () => {
  it("creates a nonce-bound, expiring state without embedding identity data", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("BETTER_AUTH_SECRET", "test-callback-state-secret-at-least-32-characters");
    const issued = issueVibyCallbackState({
      flow: "admin",
      callbackPath: "/admin/viby/callback",
      returnTo: "/admin/dashboard",
      source: "vibe_admin_confirmation",
    });
    expect(issued.state.state).toMatch(/^[0-9a-f-]{36}$/);
    expect(issued.state.expiresAt).toBeGreaterThan(Date.now());
    expect(issued.cookieValue).toContain(".");
    expect(issued.cookieValue).not.toContain("assertion");
    expect(issued.cookieValue).not.toContain("user_id");
  });
});
