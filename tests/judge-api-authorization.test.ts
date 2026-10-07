import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { withJudgeApi, type JudgeApiAuthorization } from "@/lib/judge-api";
import { resolveJudgePrincipal } from "@/lib/judge-principal";

vi.mock("@/lib/judge-principal", () => ({ resolveJudgePrincipal: vi.fn() }));
vi.mock("@/lib/judge-audit", () => ({ logJudgeAudit: vi.fn() }));

const BASE_URL = "https://vibe.example.test";

function activeResolution() {
  return {
    status: "authorized" as const,
    principal: {
      applicationPrincipal: { user: { id: "user-1", name: "Judge Account" } },
      judgeAuthorization: { id: "authorization-1" },
      judgeProfile: { id: "judge-1", name: "Judge One", email: "judge@example.test" },
      event: { id: "evt_vibe_2025" },
    },
  };
}

function request(method: "GET" | "POST", options: { cookie?: string; origin?: string; secFetchSite?: string } = {}) {
  const headers = new Headers();
  if (options.cookie) headers.set("cookie", options.cookie);
  if (options.origin) headers.set("origin", options.origin);
  if (options.secFetchSite) headers.set("sec-fetch-site", options.secFetchSite);
  return new NextRequest(`${BASE_URL}/api/scores`, { method, headers });
}

function handler() {
  const inner = vi.fn(async (
    _request: NextRequest,
    _context: unknown,
    authorization: JudgeApiAuthorization,
  ) => NextResponse.json({
    judgeId: authorization.judge.id,
    authentication: authorization.authentication,
  }));
  return {
    inner,
    read: withJudgeApi("GET /api/judge/data", inner),
    mutation: withJudgeApi("POST /api/scores", inner),
  };
}

describe("Better Auth judge API authorization", () => {
  beforeEach(() => {
    vi.stubEnv("VIBE_HACKATHON_BASE_URL", BASE_URL);
    vi.stubEnv("VIBE_JUDGE_EVENT_ID", "evt_vibe_2025");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("derives the judge only from the Better Auth application principal", async () => {
    vi.mocked(resolveJudgePrincipal).mockResolvedValue(activeResolution() as never);
    const { read } = handler();
    const response = await read(request("GET", {
      cookie: "vibe_judge_session=retired-cookie; judgeId=attacker",
    }), {});
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      judgeId: "judge-1",
      authentication: "better-auth",
    });
    expect(resolveJudgePrincipal).toHaveBeenCalledOnce();
  });

  it("returns 401 for a signed-out principal even with a legacy cookie", async () => {
    vi.mocked(resolveJudgePrincipal).mockResolvedValue({ status: "signed_out" });
    const { inner, read } = handler();
    const response = await read(request("GET", {
      cookie: "vibe_judge_session=retired-cookie",
    }), {});
    expect(response.status).toBe(401);
    expect(inner).not.toHaveBeenCalled();
  });

  it("returns 403 for an authenticated account without judge authorization", async () => {
    vi.mocked(resolveJudgePrincipal).mockResolvedValue({
      status: "forbidden",
      reason: "not_authorized",
    });
    const { inner, read } = handler();
    const response = await read(request("GET"), {});
    expect(response.status).toBe(403);
    expect(inner).not.toHaveBeenCalled();
  });

  it("checks authorization before applying same-origin mutation protection", async () => {
    vi.mocked(resolveJudgePrincipal).mockResolvedValue({ status: "signed_out" });
    const { mutation } = handler();
    expect((await mutation(request("POST", { origin: BASE_URL }), {})).status).toBe(401);
  });

  it("rejects cross-origin mutation after successful authorization", async () => {
    vi.mocked(resolveJudgePrincipal).mockResolvedValue(activeResolution() as never);
    const { inner, mutation } = handler();
    const response = await mutation(request("POST", {
      origin: "https://attacker.example",
      secFetchSite: "cross-site",
    }), {});
    expect(response.status).toBe(403);
    expect(inner).not.toHaveBeenCalled();
  });

  it("passes the principal-derived judge to same-origin mutations", async () => {
    vi.mocked(resolveJudgePrincipal).mockResolvedValue(activeResolution() as never);
    const { mutation } = handler();
    const response = await mutation(request("POST", {
      origin: BASE_URL,
      secFetchSite: "same-origin",
    }), {});
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ judgeId: "judge-1" });
  });

  it("fails closed when the configured application origin is unavailable", async () => {
    vi.stubEnv("VIBE_HACKATHON_BASE_URL", "");
    const { inner, read } = handler();
    const response = await read(request("GET"), {});
    expect(response.status).toBe(503);
    expect(inner).not.toHaveBeenCalled();
  });
});
