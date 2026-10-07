import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  encodeAdminSession,
  type AdminSession,
} from "@/lib/admin-session";
import {
  withAdminApi,
  type AdminApiAuthorization,
} from "@/lib/admin-api";
import { logAdminAudit } from "@/lib/admin-audit";

vi.mock("@/lib/admin-audit", () => ({
  logAdminAudit: vi.fn(async () => undefined),
}));
vi.mock("@/lib/viby-identity-links", () => ({
  isAuthorizedAdminVibyUser: vi.fn(async (id: string) => id !== "removed-admin"),
}));

const SESSION_SECRET = "test-admin-session-secret-that-is-at-least-32-characters";
const BASE_URL = "https://vibe.example.test";

function session(overrides: Partial<AdminSession> = {}): AdminSession {
  return {
    viby_user_id: "allowlisted-admin",
    display_name: "Allowlisted Admin",
    role: "admin",
    issued_at: Date.now(),
    expires_at: Date.now() + 60_000,
    identity_method: "face_identify",
    identity_confidence: 0.95,
    ...overrides,
  };
}

function request(
  method: string,
  options: {
    encodedSession?: string;
    origin?: string;
    secFetchSite?: string;
  } = {},
) {
  const headers = new Headers();
  if (options.encodedSession !== undefined) {
    headers.set("cookie", `${ADMIN_SESSION_COOKIE}=${options.encodedSession}`);
  }
  if (options.origin !== undefined) headers.set("origin", options.origin);
  if (options.secFetchSite !== undefined) {
    headers.set("sec-fetch-site", options.secFetchSite);
  }

  return new NextRequest(`${BASE_URL}/api/admin/events`, {
    method,
    headers,
  });
}

async function responseBody(response: Response) {
  return await response.json() as { error?: string; ok?: boolean };
}

describe("centralized admin API authorization", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VIBE_ADMIN_SESSION_SECRET", SESSION_SECRET);
    vi.stubEnv("VIBE_ADMIN_VIBY_USER_IDS", "allowlisted-admin second-admin");
    vi.stubEnv("VIBE_HACKATHON_BASE_URL", BASE_URL);
    vi.stubEnv("VIBE_ENABLE_ADMIN_DEV_FALLBACK", "false");
    vi.stubEnv("VIBE_ADMIN_COOKIE_SECURE", "true");
    vi.mocked(logAdminAudit).mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  function readHandler() {
    const handler = vi.fn(async (
      _request: NextRequest,
      _context: unknown,
      _authorization: AdminApiAuthorization,
    ) => {
      void _request;
      void _context;
      void _authorization;
      return NextResponse.json({ ok: true });
    });
    return {
      handler,
      route: withAdminApi("GET /api/admin/events", handler),
    };
  }

  function mutationHandler() {
    const handler = vi.fn(async (
      _request: NextRequest,
      _context: unknown,
      _authorization: AdminApiAuthorization,
    ) => {
      void _request;
      void _context;
      void _authorization;
      return NextResponse.json({ ok: true });
    });
    return {
      handler,
      route: withAdminApi("POST /api/admin/events", handler),
    };
  }

  it("returns 401 when the session cookie is missing", async () => {
    const { handler, route } = readHandler();
    const response = await route(request("GET"), {});

    expect(response.status).toBe(401);
    expect(await responseBody(response)).toEqual({
      error: "A valid organizer session is required.",
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it("returns 401 when the session cookie is malformed", async () => {
    const { handler, route } = readHandler();
    const response = await route(request("GET", {
      encodedSession: "not-a-valid-session",
    }), {});

    expect(response.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it("returns 401 when the session cookie is tampered", async () => {
    const encoded = encodeAdminSession(session(), SESSION_SECRET);
    const [payload] = encoded.split(".");
    const { handler, route } = readHandler();
    const response = await route(request("GET", {
      encodedSession: `${payload}.tampered-signature`,
    }), {});

    expect(response.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it("returns 401 when the session is expired", async () => {
    const encoded = encodeAdminSession(session({
      expires_at: Date.now() - 1,
    }), SESSION_SECRET);
    const { handler, route } = readHandler();
    const response = await route(request("GET", {
      encodedSession: encoded,
    }), {});

    expect(response.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it("returns 403 when a valid identity is no longer allowlisted", async () => {
    const encoded = encodeAdminSession(session({
      viby_user_id: "removed-admin",
    }), SESSION_SECRET);
    const { handler, route } = readHandler();
    const response = await route(request("GET", {
      encodedSession: encoded,
    }), {});

    expect(response.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
    expect(logAdminAudit).toHaveBeenCalledWith(
      "admin_api_access_denied",
      expect.objectContaining({
        reason: "not_authorized",
        success: false,
      }),
    );
  });

  it.each([
    ["VIBE_HACKATHON_BASE_URL", ""],
  ])("returns 503 when production configuration %s is missing", async (name, value) => {
    vi.stubEnv(name, value);
    const { handler, route } = readHandler();
    const response = await route(request("GET"), {});

    expect(response.status).toBe(503);
    expect(await responseBody(response)).toEqual({
      error: "Admin authentication is unavailable.",
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it("does not require the legacy admin allow-list when no session is presented", async () => {
    vi.stubEnv("VIBE_ADMIN_VIBY_USER_IDS", "");
    const { handler, route } = readHandler();
    const response = await route(request("GET"), {});

    expect(response.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it("returns 503 for unsafe production fallback configuration", async () => {
    vi.stubEnv("VIBE_ENABLE_ADMIN_DEV_FALLBACK", "true");
    const { handler, route } = readHandler();
    const response = await route(request("GET"), {});

    expect(response.status).toBe(503);
    expect(handler).not.toHaveBeenCalled();
  });

  it.each([
    ["HTTP", "http://vibe.example.test"],
    ["path", `${BASE_URL}/admin`],
    ["query", `${BASE_URL}?mode=admin`],
    ["fragment", `${BASE_URL}#admin`],
    ["credentials", "https://user:password@vibe.example.test"],
    ["malformed URL", "not a URL"],
  ])("returns 503 for a production base URL containing %s", async (_label, baseUrl) => {
    vi.stubEnv("VIBE_HACKATHON_BASE_URL", baseUrl);
    const { handler, route } = readHandler();
    const response = await route(request("GET"), {});

    expect(response.status).toBe(503);
    expect(handler).not.toHaveBeenCalled();
  });

  it("returns 403 for a cross-origin mutation", async () => {
    const encoded = encodeAdminSession(session(), SESSION_SECRET);
    const { handler, route } = mutationHandler();
    const response = await route(request("POST", {
      encodedSession: encoded,
      origin: "https://attacker.example",
      secFetchSite: "cross-site",
    }), {});

    expect(response.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
    expect(logAdminAudit).toHaveBeenCalledWith(
      "admin_api_access_denied",
      expect.objectContaining({
        route: "/api/admin/events",
        reason: "origin_mismatch",
        success: false,
      }),
    );
  });

  it.each([
    ["same-site different port", "https://vibe.example.test:444"],
    ["path-bearing", `${BASE_URL}/admin`],
    ["query-bearing", `${BASE_URL}?next=admin`],
    ["fragment-bearing", `${BASE_URL}#admin`],
    ["credential-bearing", "https://user:password@vibe.example.test"],
    ["malformed", "not an origin"],
    ["opaque null", "null"],
    ["trailing slash", `${BASE_URL}/`],
  ])("rejects a %s Origin header", async (_label, origin) => {
    const encoded = encodeAdminSession(session(), SESSION_SECRET);
    const { handler, route } = mutationHandler();
    const response = await route(request("POST", {
      encodedSession: encoded,
      origin,
      secFetchSite: "same-origin",
    }), {});

    expect(response.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });

  it("returns 403 when a mutation has no Origin", async () => {
    const encoded = encodeAdminSession(session(), SESSION_SECRET);
    const { handler, route } = mutationHandler();
    const response = await route(request("POST", {
      encodedSession: encoded,
    }), {});

    expect(response.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });

  it("returns 403 when Sec-Fetch-Site is not same-origin", async () => {
    const encoded = encodeAdminSession(session(), SESSION_SECRET);
    const { handler, route } = mutationHandler();
    const response = await route(request("POST", {
      encodedSession: encoded,
      origin: BASE_URL,
      secFetchSite: "same-site",
    }), {});

    expect(response.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });

  it("allows a same-origin mutation and automatically audits its result", async () => {
    const encoded = encodeAdminSession(session(), SESSION_SECRET);
    const { handler, route } = mutationHandler();
    const response = await route(request("POST", {
      encodedSession: encoded,
      origin: BASE_URL,
      secFetchSite: "same-origin",
    }), {});

    expect(response.status).toBe(200);
    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0]?.[2]).toMatchObject({
      session: {
        audit_id: expect.any(String),
      },
    });
    expect(logAdminAudit).toHaveBeenCalledWith(
      "admin_api_mutation",
      expect.objectContaining({
        audit_id: expect.any(String),
        method: "POST",
        route: "/api/admin/events",
        success: true,
        status: 200,
        timestamp: expect.any(String),
      }),
    );
  });

  it("normalizes one configured trailing slash while requiring a serialized request Origin", async () => {
    vi.stubEnv("VIBE_HACKATHON_BASE_URL", `${BASE_URL}/`);
    const encoded = encodeAdminSession(session(), SESSION_SECRET);
    const { handler, route } = mutationHandler();
    const response = await route(request("POST", {
      encodedSession: encoded,
      origin: BASE_URL,
      secFetchSite: "same-origin",
    }), {});

    expect(response.status).toBe(200);
    expect(handler).toHaveBeenCalledOnce();
  });

  it("allows a valid allowlisted session on an authenticated read", async () => {
    const encoded = encodeAdminSession(session(), SESSION_SECRET);
    const { handler, route } = readHandler();
    const response = await route(request("GET", {
      encodedSession: encoded,
    }), {});

    expect(response.status).toBe(200);
    expect(handler).toHaveBeenCalledOnce();
    expect(logAdminAudit).not.toHaveBeenCalledWith(
      "admin_api_mutation",
      expect.anything(),
    );
  });

  it("rejects a development-only route in production", async () => {
    const handler = vi.fn(async () => NextResponse.json({ ok: true }));
    const route = withAdminApi("POST /api/admin/seed", handler);
    const encoded = encodeAdminSession(session(), SESSION_SECRET);
    const response = await route(request("POST", {
      encodedSession: encoded,
      origin: BASE_URL,
      secFetchSite: "same-origin",
    }), {});

    expect(response.status).toBe(404);
    expect(handler).not.toHaveBeenCalled();
  });

  it.each(["test", "", "staging"])(
    "rejects a development-only route in production-safe mode %s",
    async (mode) => {
      vi.stubEnv("NODE_ENV", mode);
      const handler = vi.fn(async () => NextResponse.json({ ok: true }));
      const route = withAdminApi("POST /api/admin/seed", handler);
      const response = await route(request("POST"), {});

      expect(response.status).toBe(404);
      expect(handler).not.toHaveBeenCalled();
    },
  );

  it("allows a development-only route only in explicit development after auth and CSRF checks", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const handler = vi.fn(async () => NextResponse.json({ ok: true }));
    const route = withAdminApi("POST /api/admin/seed", handler);
    const encoded = encodeAdminSession(session(), SESSION_SECRET);
    const response = await route(request("POST", {
      encodedSession: encoded,
      origin: BASE_URL,
      secFetchSite: "same-origin",
    }), {});

    expect(response.status).toBe(200);
    expect(handler).toHaveBeenCalledOnce();
  });

  it.each([undefined, "", "staging"])(
    "allows Better Auth to remain independent of the transitional Viby secret when NODE_ENV=%s",
    async (mode) => {
      vi.stubEnv("NODE_ENV", mode);
      vi.stubEnv("VIBE_ADMIN_SESSION_SECRET", "");
      vi.stubEnv("BETTER_AUTH_SECRET", SESSION_SECRET);
      const { handler, route } = readHandler();
      const response = await route(request("GET"), {});

      expect(response.status).toBe(401);
      expect(handler).not.toHaveBeenCalled();
    },
  );
});
