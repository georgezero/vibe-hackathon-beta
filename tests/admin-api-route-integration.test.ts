import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/viby-identity-links", () => ({
  isAuthorizedAdminVibyUser: vi.fn(async (id: string) => id !== "removed-admin"),
}));
import { NextRequest } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  encodeAdminSession,
  type AdminSession,
} from "@/lib/admin-session";
import { getActiveEvent, getAllEvents } from "@/lib/events";
import { GET, POST } from "@/app/api/admin/events/route";

vi.mock("@/lib/admin-audit", () => ({
  logAdminAudit: vi.fn(async () => undefined),
}));

vi.mock("@/lib/db", () => ({
  db: {},
}));

vi.mock("@/lib/events", () => ({
  getActiveEvent: vi.fn(),
  getAllEvents: vi.fn(),
}));

const SESSION_SECRET = "test-admin-session-secret-that-is-at-least-32-characters";
const BASE_URL = "https://vibe.example.test";

function session(vibyUserId = "allowlisted-admin"): AdminSession {
  return {
    viby_user_id: vibyUserId,
    display_name: "Route Test Admin",
    role: "admin",
    issued_at: Date.now(),
    expires_at: Date.now() + 60_000,
    identity_method: "face_identify",
    identity_confidence: 0.95,
  };
}

function request(
  method: "GET" | "POST",
  options: {
    encodedSession?: string;
    origin?: string;
  } = {},
) {
  const headers = new Headers();
  if (options.encodedSession) {
    headers.set("cookie", `${ADMIN_SESSION_COOKIE}=${options.encodedSession}`);
  }
  if (options.origin) headers.set("origin", options.origin);

  return new NextRequest(`${BASE_URL}/api/admin/events`, {
    method,
    headers,
  });
}

describe("converted admin event route", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VIBE_ADMIN_SESSION_SECRET", SESSION_SECRET);
    vi.stubEnv("VIBE_ADMIN_VIBY_USER_IDS", "allowlisted-admin");
    vi.stubEnv("VIBE_HACKATHON_BASE_URL", BASE_URL);
    vi.stubEnv("VIBE_ENABLE_ADMIN_DEV_FALLBACK", "false");
    vi.stubEnv("VIBE_ADMIN_COOKIE_SECURE", "true");

    vi.mocked(getActiveEvent).mockResolvedValue({
      id: "event-test",
      name: "Test Event",
      isActive: true,
    } as Awaited<ReturnType<typeof getActiveEvent>>);
    vi.mocked(getAllEvents).mockResolvedValue([] as Awaited<ReturnType<typeof getAllEvents>>);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("rejects an anonymous request before event data is read", async () => {
    const response = await GET(request("GET"), undefined as never);

    expect(response.status).toBe(401);
    expect(getActiveEvent).not.toHaveBeenCalled();
    expect(getAllEvents).not.toHaveBeenCalled();
  });

  it("rejects a removed organizer before event data is read", async () => {
    const response = await GET(request("GET", {
      encodedSession: encodeAdminSession(session("removed-admin"), SESSION_SECRET),
    }), undefined as never);

    expect(response.status).toBe(403);
    expect(getActiveEvent).not.toHaveBeenCalled();
    expect(getAllEvents).not.toHaveBeenCalled();
  });

  it("allows an allowlisted organizer to use the converted GET route", async () => {
    const response = await GET(request("GET", {
      encodedSession: encodeAdminSession(session(), SESSION_SECRET),
    }), undefined as never);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      activeEvent: {
        id: "event-test",
        name: "Test Event",
        isActive: true,
      },
      events: [],
    });
    expect(getActiveEvent).toHaveBeenCalledOnce();
    expect(getAllEvents).toHaveBeenCalledOnce();
  });

  it("rejects a cross-origin mutation before its handler reads the body", async () => {
    const response = await POST(request("POST", {
      encodedSession: encodeAdminSession(session(), SESSION_SECRET),
      origin: "https://attacker.example",
    }), undefined as never);

    expect(response.status).toBe(403);
  });
});
