import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { decodeAdminSession, encodeAdminSession, type AdminSession } from "../lib/admin-session";
import { verifyVibyAgentAttributionAssertion, verifyVibyAssertion, VibyAssertionError } from "../lib/viby";

const baseExpiresAt = Date.now() + 60_000;
const baseVerifiedAt = new Date().toISOString();
const baseAssertion = {
  effectiveMode: "admin",
  assertion: {
    id: "assertion_valid",
    type: "host_app_entry",
    audience: "vibe-hackathon",
    effectiveMode: "admin",
    expiresAt: baseExpiresAt,
  },
  user: {
    id: "viby_user_1",
    displayName: "Admin User",
  },
  identity: {
    method: "face_identify",
    confidence: 0.91,
    sessionId: "session_1",
    verifiedAt: baseVerifiedAt,
    freshVerification: true,
    verificationKind: "fresh",
  },
  payload: {
    user_id: "viby_user_1",
    display_name: "Admin User",
    method: "face_identify",
    confidence: 0.91,
    session_id: "session_1",
    audience: "vibe-hackathon",
    subject_type: "human",
    context: { mode: "admin", forceIdentityCheck: true },
    issued_at: new Date().toISOString(),
    expires_at: new Date(baseExpiresAt).toISOString(),
  },
};
const confidentialAssertionId = "123e4567-e89b-42d3-a456-426614174000";

const agentAssertion = {
  assertion: {
    id: "assertion_agent",
    audience: "vibe-hackathon",
    expiresAt: Date.now() + 60_000,
  },
  user: {
    id: "owner_user_1",
    displayName: "George One",
  },
  identity: {
    method: "agent_delegation",
    confidence: 1,
    sessionId: "session_agent",
  },
  payload: {
    subject_type: "agent",
    agent_id: "agent_1",
    agent_name: "Demo Agent",
    agent_display_name: "Demo Agent",
    owner_user_id: "owner_user_1",
    owner_display_name: "George One",
    delegation_method: "owner_registered",
    method: "agent_delegation",
    confidence: 1,
    session_id: "session_agent",
    audience: "vibe-hackathon",
    context: { mode: "agent-attribution" },
    issued_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 60_000).toISOString(),
  },
};

function mockVibyResponse(body: unknown, init: ResponseInit = { status: 200 }) {
  vi.stubGlobal("fetch", vi.fn(async () => Response.json(body, init)));
}

async function expectVibyRejection(assertionId: string, code: InstanceType<typeof VibyAssertionError>["code"]) {
  await expect(verifyVibyAssertion(assertionId)).rejects.toMatchObject({
    code,
  });
}

describe("Viby admin assertion verification", () => {
  beforeEach(() => {
    vi.stubEnv("VIBY_BASE_URL", "https://viby.test");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("accepts a valid Viby admin assertion", async () => {
    mockVibyResponse(baseAssertion);

    const assertion = await verifyVibyAssertion("assertion_valid");

    expect(assertion.vibyUserId).toBe("viby_user_1");
    expect(assertion.audience).toBe("vibe-hackathon");
    expect(assertion.method).toBe("face_identify");
    expect(assertion.confidence).toBe(0.91);
  });

  it("uses confidential assertion_id redemption and parses the deployed envelope", async () => {
    vi.stubEnv("VIBY_CLIENT_SECRET", "test-client-secret");
    mockVibyResponse({
      ...baseAssertion,
      assertion: {
        ...baseAssertion.assertion,
        id: confidentialAssertionId,
        returnTo: "https://app.example/admin/viby/callback?state=expected-state",
      },
    });
    const assertion = await verifyVibyAssertion(confidentialAssertionId, {
      confidential: true,
      requireFresh: true,
      expectedCallbackState: "expected-state",
    });
    const fetchMock = vi.mocked(fetch);
    const [, init] = fetchMock.mock.calls[0];
    expect(fetchMock.mock.calls[0][0]).toBe("https://viby.test/api/identity/assertions/redeem");
    expect(init).toMatchObject({
      method: "POST",
      redirect: "manual",
      body: JSON.stringify({ assertion_id: confidentialAssertionId }),
    });
    expect((init?.headers as Record<string, string>).Authorization).toMatch(/^Basic /);
    expect(assertion.vibyUserId).toBe("viby_user_1");
  });

  it("rejects an assertion issued for a different callback transaction", async () => {
    vi.stubEnv("VIBY_CLIENT_SECRET", "test-client-secret");
    mockVibyResponse({
      ...baseAssertion,
      assertion: {
        ...baseAssertion.assertion,
        id: confidentialAssertionId,
        returnTo: "https://app.example/admin/viby/callback?state=other-state",
      },
    });
    await expect(verifyVibyAssertion(confidentialAssertionId, {
      confidential: true,
      expectedCallbackState: "expected-state",
    })).rejects.toMatchObject({ code: "wrong_context" });
  });

  it("rejects agent assertions and missing fresh-verification evidence for human login", async () => {
    mockVibyResponse({
      ...baseAssertion,
      assertion: { ...baseAssertion.assertion, type: "agent_host_app_entry" },
      payload: { ...baseAssertion.payload, subject_type: "agent" },
    });
    await expect(verifyVibyAssertion("agent-as-human")).rejects.toMatchObject({ code: "wrong_context" });

    mockVibyResponse({
      ...baseAssertion,
      identity: { ...baseAssertion.identity, freshVerification: false, verificationKind: "remembered" },
    });
    await expect(verifyVibyAssertion("not-fresh", { requireFresh: true }))
      .rejects.toMatchObject({ code: "wrong_context" });
  });

  it("denies expired assertions", async () => {
    mockVibyResponse({
      ...baseAssertion,
      assertion: { ...baseAssertion.assertion, expiresAt: Date.now() - 1 },
    });

    await expectVibyRejection("assertion_expired", "assertion_expired");
  });

  it("denies wrong-audience assertions", async () => {
    mockVibyResponse({
      ...baseAssertion,
      assertion: { ...baseAssertion.assertion, audience: "mock-host" },
      payload: { ...baseAssertion.payload, audience: "mock-host" },
    });

    await expectVibyRejection("assertion_wrong_audience", "wrong_audience");
  });

  it("denies malformed JSON", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("not-json", { status: 200 })));

    await expectVibyRejection("assertion_malformed", "invalid_payload");
  });

  it("denies assertions without a valid user", async () => {
    mockVibyResponse({
      ...baseAssertion,
      user: null,
      payload: { ...baseAssertion.payload, user_id: "" },
    });

    await expectVibyRejection("assertion_no_user", "invalid_payload");
  });

  it("denies assertions without a valid method", async () => {
    mockVibyResponse({
      ...baseAssertion,
      identity: { ...baseAssertion.identity, method: null },
      payload: { ...baseAssertion.payload, method: null },
    });

    await expectVibyRejection("assertion_no_method", "invalid_payload");
  });

  it("does not treat caller-controlled context as authoritative", async () => {
    mockVibyResponse({
      ...baseAssertion,
      payload: { ...baseAssertion.payload, context: { mode: "mock-host" } },
    });
    await expect(verifyVibyAssertion("opaque-context", { requireFresh: true }))
      .resolves.toMatchObject({ freshVerification: true, effectiveMode: "admin" });
  });

  it.each([
    ["verifiedAt", { ...baseAssertion, identity: { ...baseAssertion.identity, verifiedAt: undefined } }],
    ["sessionId", { ...baseAssertion, identity: { ...baseAssertion.identity, sessionId: undefined } }],
    ["effectiveMode", { ...baseAssertion, effectiveMode: undefined }],
    ["issued_at", { ...baseAssertion, payload: { ...baseAssertion.payload, issued_at: undefined } }],
    ["expires_at", { ...baseAssertion, payload: { ...baseAssertion.payload, expires_at: undefined } }],
  ])("fails closed when authoritative %s is missing", async (_field, response) => {
    mockVibyResponse(response);
    await expect(verifyVibyAssertion("missing-field", { requireFresh: true })).rejects.toBeInstanceOf(VibyAssertionError);
  });

  it("rejects remembered, stale, unknown-type, and wrong-mode assertions", async () => {
    for (const response of [
      { ...baseAssertion, identity: { ...baseAssertion.identity, freshVerification: false, verificationKind: "remembered" } },
      { ...baseAssertion, identity: { ...baseAssertion.identity, verifiedAt: new Date(Date.now() - 600_000).toISOString() } },
      { ...baseAssertion, assertion: { ...baseAssertion.assertion, type: "future_human_assertion" } },
      { ...baseAssertion, assertion: { ...baseAssertion.assertion, effectiveMode: "agent-attribution" } },
    ]) {
      mockVibyResponse(response);
      await expect(verifyVibyAssertion("strict-rejection", { requireFresh: true })).rejects.toBeInstanceOf(VibyAssertionError);
    }
  });

  it("fails closed when VIBY_BASE_URL is missing in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VIBY_BASE_URL", "");

    await expectVibyRejection("assertion_valid", "missing_config");
  });
});

describe("Viby agent attribution assertion verification", () => {
  beforeEach(() => {
    vi.stubEnv("VIBY_BASE_URL", "http://viby.test");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("accepts a valid Viby agent attribution assertion", async () => {
    mockVibyResponse(agentAssertion);

    const assertion = await verifyVibyAgentAttributionAssertion("assertion_agent");

    expect(assertion.agentDisplayName).toBe("Demo Agent");
    expect(assertion.ownerDisplayName).toBe("George One");
    expect(assertion.ownerVibyUserId).toBe("owner_user_1");
    expect(assertion.delegationMethod).toBe("owner_registered");
  });

  it("falls back to stable IDs when agent display fields are missing", async () => {
    mockVibyResponse({
      ...agentAssertion,
      payload: {
        ...agentAssertion.payload,
        agent_name: "",
        agent_display_name: "",
        owner_display_name: "",
      },
    });

    const assertion = await verifyVibyAgentAttributionAssertion("assertion_agent_fallback");

    expect(assertion.agentDisplayName).toBe("Agent agent_1");
    expect(assertion.ownerDisplayName).toBe("owner_user_1");
  });

  it("denies human assertions for agent attribution", async () => {
    mockVibyResponse({
      ...baseAssertion,
      payload: { ...baseAssertion.payload, context: { mode: "agent-attribution" } },
    });

    await expect(verifyVibyAgentAttributionAssertion("assertion_human")).rejects.toMatchObject({
      code: "invalid_payload",
    });
  });

  it("denies agent assertions with the wrong mode", async () => {
    mockVibyResponse({
      ...agentAssertion,
      payload: { ...agentAssertion.payload, context: { mode: "admin" } },
    });

    await expect(verifyVibyAgentAttributionAssertion("assertion_wrong_mode")).rejects.toMatchObject({
      code: "wrong_context",
    });
  });
});

describe("signed admin session", () => {
  const secret = "test-admin-session-secret";
  const session: AdminSession = {
    viby_user_id: "viby_user_1",
    display_name: "Admin User",
    role: "admin",
    issued_at: Date.now(),
    expires_at: Date.now() + 60_000,
    identity_method: "face_identify",
    identity_confidence: 0.91,
  };

  it("validates a signed admin session", () => {
    const encoded = encodeAdminSession(session, secret);

    expect(decodeAdminSession(encoded, secret)).toMatchObject({
      viby_user_id: "viby_user_1",
      role: "admin",
      identity_method: "face_identify",
    });
  });

  it("rejects a tampered admin session", () => {
    const encoded = encodeAdminSession(session, secret);
    const [payload, signature] = encoded.split(".");
    const tamperedPayload = Buffer.from(JSON.stringify({
      ...session,
      viby_user_id: "attacker",
    })).toString("base64url");

    expect(decodeAdminSession(`${tamperedPayload}.${signature}`, secret)).toBeNull();
    expect(decodeAdminSession(`${payload}.bad-signature`, secret)).toBeNull();
  });

  it("rejects an expired admin session", () => {
    const encoded = encodeAdminSession({
      ...session,
      expires_at: Date.now() - 1,
    }, secret);

    expect(decodeAdminSession(encoded, secret)).toBeNull();
  });
});
