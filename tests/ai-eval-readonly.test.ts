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
import { GET as getAdminPacket } from "@/app/api/admin/ai-runs/packet/[submissionId]/route";
import { GET as getAdminPrompt } from "@/app/api/admin/ai-runs/prompt/[submissionId]/route";
import { GET as getPublicPacket } from "@/app/api/v1/ai-eval/packet/[submissionId]/route";
import { GET as getPublicPrompt } from "@/app/api/v1/ai-eval/prompt/[submissionId]/route";

const dbMocks = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  where: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    select: dbMocks.select,
    insert: dbMocks.insert,
    update: dbMocks.update,
  },
}));

vi.mock("@/lib/events", () => ({
  getActiveEvent: vi.fn(async () => ({
    id: "event-readonly",
    name: "Read-only Event",
    displayName: "Read-only Event",
  })),
}));

vi.mock("@/lib/admin-audit", () => ({
  logAdminAudit: vi.fn(async () => undefined),
}));

const BASE_URL = "https://vibe.example.test";
const SESSION_SECRET = "test-admin-session-secret-that-is-at-least-32-characters";
const SUBMISSION_ID = "sub_readonly";

const submission = {
  id: SUBMISSION_ID,
  teamName: "Read-only Team",
  projectTitle: "Read-only Project",
  problemStatement: null,
  targetUsers: null,
  githubUrl: null,
  demoUrl: null,
  demoVideoUrl: null,
  screenshotUrl: null,
  screenshotUrls: [],
  budgetTier: null,
  estimatedHumanHours: null,
  estimatedAgentHours: null,
  agentModels: null,
  agentHarnesses: null,
  license: null,
  tags: null,
  status: "finalized",
  submittedAt: new Date("2026-01-01T00:00:00.000Z"),
  finalizedAt: new Date("2026-01-02T00:00:00.000Z"),
};

function adminSession(): AdminSession {
  return {
    viby_user_id: "allowlisted-admin",
    display_name: "Allowlisted Admin",
    role: "admin",
    issued_at: Date.now(),
    expires_at: Date.now() + 60_000,
    identity_method: "face_identify",
    identity_confidence: 0.95,
  };
}

function routeContext() {
  return { params: Promise.resolve({ submissionId: SUBMISSION_ID }) };
}

function publicRequest(path: "packet" | "prompt") {
  return new NextRequest(
    `${BASE_URL}/api/v1/ai-eval/${path}/${SUBMISSION_ID}`,
  );
}

function adminRequest(path: "packet" | "prompt") {
  const encoded = encodeAdminSession(adminSession(), SESSION_SECRET);
  return new NextRequest(
    `${BASE_URL}/api/admin/ai-runs/${path}/${SUBMISSION_ID}`,
    {
      headers: {
        cookie: `${ADMIN_SESSION_COOKIE}=${encoded}`,
      },
    },
  );
}

describe("AI evaluation packet and prompt reads", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("VIBE_HACKATHON_BASE_URL", BASE_URL);
    vi.stubEnv("VIBE_ADMIN_SESSION_SECRET", SESSION_SECRET);
    vi.stubEnv("VIBE_ADMIN_VIBY_USER_IDS", "allowlisted-admin");
    vi.stubEnv("VIBE_ENABLE_ADMIN_DEV_FALLBACK", "false");
    vi.stubEnv("VIBE_ADMIN_COOKIE_SECURE", "true");

    let selectNumber = 0;
    dbMocks.where.mockImplementation(async () => {
      const result = selectNumber % 2 === 0 ? [submission] : [];
      selectNumber += 1;
      return result;
    });
    dbMocks.select.mockImplementation(() => ({
      from: vi.fn(() => ({ where: dbMocks.where })),
    }));
    dbMocks.insert.mockImplementation(() => ({
      values: vi.fn(async () => undefined),
    }));
    dbMocks.update.mockImplementation(() => ({
      set: vi.fn(() => ({ where: vi.fn(async () => undefined) })),
    }));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("admin GET packet and prompt do not insert or update evaluation tokens", async () => {
    const packetResponse = await getAdminPacket(
      adminRequest("packet"),
      routeContext(),
    );
    const promptResponse = await getAdminPrompt(
      adminRequest("prompt"),
      routeContext(),
    );

    expect(packetResponse.status).toBe(200);
    expect(promptResponse.status).toBe(200);
    expect(dbMocks.insert).not.toHaveBeenCalled();
    expect(dbMocks.update).not.toHaveBeenCalled();
  });

  it("public GET packet and prompt expose no token and perform no token mutation", async () => {
    const packetResponse = await getPublicPacket(
      publicRequest("packet"),
      routeContext(),
    );
    const promptResponse = await getPublicPrompt(
      publicRequest("prompt"),
      routeContext(),
    );
    const packet = await packetResponse.json() as Record<string, unknown>;
    const prompt = await promptResponse.text();

    expect(packetResponse.status).toBe(200);
    expect(promptResponse.status).toBe(200);
    expect(packet).not.toHaveProperty("evaluation_token");
    expect(packet).not.toHaveProperty("import_url");
    expect(prompt).not.toContain("Evaluation Token");
    expect(prompt).not.toContain("/api/admin/");
    expect(dbMocks.insert).not.toHaveBeenCalled();
    expect(dbMocks.update).not.toHaveBeenCalled();
  });

  it("repeated public GET requests leave token state unchanged", async () => {
    for (let index = 0; index < 3; index += 1) {
      const response = await getPublicPacket(
        publicRequest("packet"),
        routeContext(),
      );
      expect(response.status).toBe(200);
    }

    expect(dbMocks.insert).not.toHaveBeenCalled();
    expect(dbMocks.update).not.toHaveBeenCalled();
  });
});
