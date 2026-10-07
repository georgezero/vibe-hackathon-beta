import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getRuntimeMode,
  isExplicitDevelopmentRuntime,
  isProductionSafeRuntime,
} from "@/lib/runtime-mode";
import {
  AdminSessionConfigurationError,
  adminSessionSigningSecret,
} from "@/lib/admin-session";
import { canonicalizeConfiguredBaseUrl } from "@/lib/base-url";

describe("runtime mode policy", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    ["production", "production", false, true],
    ["development", "development", true, false],
    ["test", "test", false, true],
    [undefined, "unknown", false, true],
    ["", "unknown", false, true],
    ["staging", "unknown", false, true],
  ] as const)(
    "classifies NODE_ENV=%s as %s",
    (value, mode, development, productionSafe) => {
      if (value === undefined) {
        vi.stubEnv("NODE_ENV", undefined);
      } else {
        vi.stubEnv("NODE_ENV", value);
      }

      expect(getRuntimeMode()).toBe(mode);
      expect(isExplicitDevelopmentRuntime()).toBe(development);
      expect(isProductionSafeRuntime()).toBe(productionSafe);
    },
  );

  it("allows the Better Auth signing fallback only in explicit development", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("VIBE_ADMIN_SESSION_SECRET", "");
    vi.stubEnv("BETTER_AUTH_SECRET", "development-better-auth-secret");

    expect(adminSessionSigningSecret()).toBe("development-better-auth-secret");
  });

  it.each([
    ["production", "production"],
    ["test", "test"],
    ["missing", undefined],
    ["empty", ""],
    ["unknown", "staging"],
  ] as const)(
    "rejects the Better Auth signing fallback in production-safe mode %s",
    (_label, mode) => {
      vi.stubEnv("NODE_ENV", mode);
      vi.stubEnv("VIBE_ADMIN_SESSION_SECRET", "");
      vi.stubEnv("BETTER_AUTH_SECRET", "must-not-be-used");

      expect(() => adminSessionSigningSecret()).toThrow(
        AdminSessionConfigurationError,
      );
    },
  );

  it.each([
    ["production", "production"],
    ["test", "test"],
    ["missing", undefined],
    ["empty", ""],
    ["unknown", "staging"],
  ] as const)(
    "requires HTTPS for a configured base URL in production-safe mode %s",
    (_label, mode) => {
      vi.stubEnv("NODE_ENV", mode);

      expect(() => canonicalizeConfiguredBaseUrl("http://vibe.example.test"))
        .toThrow("VIBE_HACKATHON_BASE_URL must use HTTPS.");
    },
  );

  it("allows an HTTP canonical base URL only in explicit development", () => {
    vi.stubEnv("NODE_ENV", "development");

    expect(canonicalizeConfiguredBaseUrl("http://localhost:3000/"))
      .toBe("http://localhost:3000");
  });
});
