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
import {
  aiEvaluationTokens,
  aiJudgeRuns,
  aiReviews,
  submissions,
} from "@/lib/db/schema";
import { POST as issueToken } from "@/app/api/admin/ai-runs/token/[submissionId]/route";
import { GET as getAdminPacket } from "@/app/api/admin/ai-runs/packet/[submissionId]/route";
import { GET as getExternalPacket } from "@/app/api/v1/ai-eval/external/packet/[submissionId]/route";
import { GET as getExternalPrompt } from "@/app/api/v1/ai-eval/external/prompt/[submissionId]/route";
import { POST as importExternalResult } from "@/app/api/v1/ai-eval/external/import/[submissionId]/route";

const dbMocks = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
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
    id: "event-external",
    name: "External Evaluation Event",
    displayName: "External Evaluation Event",
    isFrozen: false,
  })),
}));

vi.mock("@/lib/admin-audit", () => ({
  logAdminAudit: vi.fn(async () => undefined),
}));

const BASE_URL = "https://vibe.example.test";
const SESSION_SECRET = "test-admin-session-secret-that-is-at-least-32-characters";
const SUBMISSION_A = "sub_external_a";
const SUBMISSION_B = "sub_external_b";

const submissionRows = [
  {
    id: SUBMISSION_A,
    teamName: "External Team A",
    projectTitle: "External Project A",
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
  },
  {
    id: SUBMISSION_B,
    teamName: "External Team B",
    projectTitle: "External Project B",
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
  },
];

type StoredToken = {
  id: string;
  submissionId: string;
  token: string;
  createdAt: Date;
  expiresAt?: Date | null;
  createdBy?: string | null;
  lastUsedAt?: Date | null;
};

const storedTokens: StoredToken[] = [];
const storedRuns: Array<Record<string, unknown>> = [];

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

function context(submissionId: string) {
  return { params: Promise.resolve({ submissionId }) };
}

function adminTokenRequest(submissionId: string) {
  const encoded = encodeAdminSession(adminSession(), SESSION_SECRET);
  return new NextRequest(
    `${BASE_URL}/api/admin/ai-runs/token/${submissionId}`,
    {
      method: "POST",
      headers: {
        cookie: `${ADMIN_SESSION_COOKIE}=${encoded}`,
        origin: BASE_URL,
        "sec-fetch-site": "same-origin",
      },
    },
  );
}

function externalRequest(
  method: "GET" | "POST",
  operation: "packet" | "prompt" | "import",
  submissionId: string,
  token?: string,
  body?: Record<string, unknown>,
) {
  const headers = new Headers();
  if (token) headers.set("authorization", `Bearer ${token}`);
  if (body) headers.set("content-type", "application/json");
  return new NextRequest(
    `${BASE_URL}/api/v1/ai-eval/external/${operation}/${submissionId}`,
    {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    },
  );
}

const validScores = {
  product_sense_score: 80,
  originality_score: 81,
  execution_score: 82,
  ai_collaboration_score: 83,
  usefulness_score: 84,
  presentation_score: 85,
  overall_score: 83,
};

describe("submission-scoped external AI evaluation flow", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("VIBE_HACKATHON_BASE_URL", BASE_URL);
    vi.stubEnv("VIBE_ADMIN_SESSION_SECRET", SESSION_SECRET);
    vi.stubEnv("VIBE_ADMIN_VIBY_USER_IDS", "allowlisted-admin");
    vi.stubEnv("VIBE_ENABLE_ADMIN_DEV_FALLBACK", "false");
    vi.stubEnv("VIBE_ADMIN_COOKIE_SECURE", "true");
    storedTokens.splice(0);
    storedRuns.splice(0);

    dbMocks.select.mockImplementation(() => ({
      from: vi.fn((table) => ({
        where: vi.fn(async () => {
          if (table === submissions) return submissionRows;
          if (table === aiEvaluationTokens) return storedTokens;
          if (table === aiReviews) return [];
          return [];
        }),
      })),
    }));
    dbMocks.insert.mockImplementation((table) => ({
      values: vi.fn(async (value: Record<string, unknown>) => {
        if (table === aiEvaluationTokens) {
          storedTokens.push(value as StoredToken);
        }
        if (table === aiJudgeRuns) {
          storedRuns.push(value);
        }
      }),
    }));
    dbMocks.update.mockImplementation((table) => ({
      set: vi.fn((value: Record<string, unknown>) => ({
        where: vi.fn(async () => {
          if (table === aiEvaluationTokens) {
            for (const token of storedTokens) Object.assign(token, value);
          }
        }),
      })),
    }));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("issues one token and returns an executable scoped external command", async () => {
    const first = await issueToken(
      adminTokenRequest(SUBMISSION_A),
      context(SUBMISSION_A),
    );
    const firstBody = await first.json() as {
      token: string;
      promptUrl: string;
      packetUrl: string;
      importUrl: string;
      curlCommand: string;
    };
    const second = await issueToken(
      adminTokenRequest(SUBMISSION_A),
      context(SUBMISSION_A),
    );
    const secondBody = await second.json() as { token: string };

    expect(first.status).toBe(200);
    expect(firstBody.token).toMatch(/^eval_/);
    expect(secondBody.token).toBe(firstBody.token);
    expect(storedTokens).toHaveLength(1);
    expect(firstBody.promptUrl).toBe(
      `${BASE_URL}/api/v1/ai-eval/external/prompt/${SUBMISSION_A}`,
    );
    expect(firstBody.packetUrl).toContain("/api/v1/ai-eval/external/packet/");
    expect(firstBody.importUrl).toContain("/api/v1/ai-eval/external/import/");
    expect(firstBody.curlCommand).toContain("Authorization: Bearer eval_");
    expect(firstBody.curlCommand).not.toContain("/api/admin/");
    expect(firstBody.curlCommand).not.toContain("Cookie:");
  });

  it("allows scoped reads without an organizer cookie and keeps them read-only", async () => {
    const issued = await issueToken(
      adminTokenRequest(SUBMISSION_A),
      context(SUBMISSION_A),
    );
    const { token } = await issued.json() as { token: string };
    const updateCallsBeforeReads = dbMocks.update.mock.calls.length;

    const packet = await getExternalPacket(
      externalRequest("GET", "packet", SUBMISSION_A, token),
      context(SUBMISSION_A),
    );
    const prompt = await getExternalPrompt(
      externalRequest("GET", "prompt", SUBMISSION_A, token),
      context(SUBMISSION_A),
    );

    expect(packet.status).toBe(200);
    expect(prompt.status).toBe(200);
    expect(dbMocks.update.mock.calls).toHaveLength(updateCallsBeforeReads);
  });

  it("rejects missing, wrong, and cross-submission evaluation tokens", async () => {
    const issued = await issueToken(
      adminTokenRequest(SUBMISSION_A),
      context(SUBMISSION_A),
    );
    const { token } = await issued.json() as { token: string };

    const missing = await getExternalPacket(
      externalRequest("GET", "packet", SUBMISSION_A),
      context(SUBMISSION_A),
    );
    const wrong = await getExternalPacket(
      externalRequest("GET", "packet", SUBMISSION_A, "eval_wrong"),
      context(SUBMISSION_A),
    );
    const crossSubmission = await getExternalPacket(
      externalRequest("GET", "packet", SUBMISSION_B, token),
      context(SUBMISSION_B),
    );

    expect(missing.status).toBe(401);
    expect(wrong.status).toBe(403);
    expect(crossSubmission.status).toBe(403);
  });

  it("does not let an evaluation token cross the admin API boundary", async () => {
    const issued = await issueToken(
      adminTokenRequest(SUBMISSION_A),
      context(SUBMISSION_A),
    );
    const { token } = await issued.json() as { token: string };
    const request = new NextRequest(
      `${BASE_URL}/api/admin/ai-runs/packet/${SUBMISSION_A}`,
      { headers: { authorization: `Bearer ${token}` } },
    );

    const response = await getAdminPacket(request, context(SUBMISSION_A));

    expect(response.status).toBe(401);
  });

  it("imports only with the correct token bound to the path submission", async () => {
    const issued = await issueToken(
      adminTokenRequest(SUBMISSION_A),
      context(SUBMISSION_A),
    );
    const { token } = await issued.json() as { token: string };
    const body = {
      submission_id: SUBMISSION_A,
      provider: "test-provider",
      model_name: "test-model",
      scores_json: validScores,
    };

    const wrongToken = await importExternalResult(
      externalRequest("POST", "import", SUBMISSION_A, "eval_wrong", body),
      context(SUBMISSION_A),
    );
    const mismatchedBody = await importExternalResult(
      externalRequest("POST", "import", SUBMISSION_A, token, {
        ...body,
        submission_id: SUBMISSION_B,
      }),
      context(SUBMISSION_A),
    );
    const success = await importExternalResult(
      externalRequest("POST", "import", SUBMISSION_A, token, body),
      context(SUBMISSION_A),
    );

    expect(wrongToken.status).toBe(403);
    expect(mismatchedBody.status).toBe(403);
    expect(success.status).toBe(200);
    expect(storedRuns).toHaveLength(1);
    expect(storedRuns[0]).toMatchObject({
      submissionId: SUBMISSION_A,
      modelProvider: "external/test-provider",
    });
    expect(storedTokens[0]?.lastUsedAt).toBeInstanceOf(Date);
  });
});
