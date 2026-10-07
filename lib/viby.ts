import { isExplicitDevelopmentRuntime, isProductionSafeRuntime } from "./runtime-mode";

export interface VibyIdentityAssertion {
  assertionId: string;
  audience: string;
  vibyUserId: string;
  displayName: string;
  tag: string | null;
  affiliation: string | null;
  method: string | null;
  confidence: number | null;
  sessionId: string | null;
  verifiedAt: string;
  freshVerification: boolean;
  verificationKind: "fresh" | "remembered";
  effectiveMode: string;
  issuedAt: string | null;
  expiresAt: string | null;
  context: Record<string, unknown> | null;
  returnTo: string | null;
}

export interface VibyAgentAssertion {
  assertionId: string;
  audience: string;
  agentId: string;
  agentName: string;
  agentDisplayName: string;
  ownerVibyUserId: string;
  ownerDisplayName: string;
  delegationMethod: string;
  method: string | null;
  issuedAt: string | null;
  expiresAt: string | null;
  context: Record<string, unknown> | null;
}

type VibyAssertionResponse = {
  assertion?: {
    id?: string;
    type?: string;
    audience?: string | null;
    returnTo?: string | null;
    expiresAt?: number | null;
    effectiveMode?: string | null;
  };
  user?: {
    id?: string;
    displayName?: string;
    tag?: string | null;
    affiliation?: string | null;
  } | null;
  identity?: {
    method?: string | null;
    confidence?: number | null;
    sessionId?: string | null;
    verifiedAt?: string | null;
    freshVerification?: boolean;
    verificationKind?: string;
  } | null;
  payload?: {
    subject_type?: string;
    subject_user_id?: string;
    subject_display_name?: string;
    agent_id?: string;
    agent_name?: string;
    agent_display_name?: string;
    owner_user_id?: string;
    owner_display_name?: string;
    delegation_method?: string;
    user_id?: string;
    display_name?: string;
    tag?: string | null;
    affiliation?: string | null;
    method?: string | null;
    confidence?: number | null;
    session_id?: string | null;
    audience?: string | null;
    context?: Record<string, unknown> | null;
    issued_at?: string | null;
    expires_at?: string | null;
  };
  effectiveMode?: string | null;
};

export class VibyAssertionError extends Error {
  constructor(
    public code: "missing_assertion" | "missing_config" | "viby_unavailable" | "assertion_not_found" | "assertion_expired" | "assertion_consumed" | "wrong_audience" | "wrong_context" | "invalid_payload",
    message: string,
  ) {
    super(message);
  }
}

const VIBY_ADMIN_MODE = "admin";
const MAX_FRESH_AUTH_AGE_MS = 5 * 60 * 1000;

export function hasCurrentFreshVibyEvidence(
  assertion: Pick<VibyIdentityAssertion, "freshVerification" | "verificationKind" | "verifiedAt">,
  now = Date.now(),
) {
  const verifiedAt = Date.parse(assertion.verifiedAt);
  return assertion.freshVerification === true
    && assertion.verificationKind === "fresh"
    && Number.isFinite(verifiedAt)
    && verifiedAt <= now + 30_000
    && now - verifiedAt <= MAX_FRESH_AUTH_AGE_MS;
}

export function vibyBaseUrl(options: { allowDefault?: boolean } = {}) {
  const configured = process.env.VIBY_BASE_URL;
  const allowDefault = options.allowDefault ?? isExplicitDevelopmentRuntime();
  if (!configured && !allowDefault) {
    throw new VibyAssertionError("missing_config", "VIBY_BASE_URL is required for Viby identity confirmation.");
  }
  return (configured ?? "http://localhost:3001").replace(/\/$/, "");
}

export function vibyAppSlug() {
  return process.env.VIBY_APP_SLUG ?? "vibe-hackathon";
}

export type VibyAdminSessionMode = "legacy" | "better-auth" | "disabled";

export function vibyAdminSessionMode(): VibyAdminSessionMode {
  const configured = process.env.VIBE_VIBY_SESSION_MODE?.trim() || "legacy";
  if (configured === "legacy" || configured === "better-auth" || configured === "disabled") {
    return configured;
  }
  throw new VibyAssertionError("missing_config", "VIBE_VIBY_SESSION_MODE is invalid.");
}

export function allowedAdminVibyUserIds() {
  return new Set(
    (process.env.VIBE_ADMIN_VIBY_USER_IDS ?? "")
      .split(/[,\s]+/)
      .map((id) => id.trim())
      .filter(Boolean),
  );
}

export function isAllowedAdminVibyUser(vibyUserId: string) {
  return allowedAdminVibyUserIds().has(vibyUserId);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function parseJsonResponse(response: Response) {
  try {
    return await response.json() as VibyAssertionResponse;
  } catch {
    throw new VibyAssertionError("invalid_payload", "Viby returned malformed assertion JSON.");
  }
}

function validConfidence(value: number | null | undefined) {
  return value === null || value === undefined || (Number.isFinite(value) && value >= 0 && value <= 1);
}

export async function verifyVibyAssertion(
  assertionId: string,
  options: { confidential?: boolean; requireFresh?: boolean; expectedCallbackState?: string } = {},
): Promise<VibyIdentityAssertion> {
  const id = assertionId.trim();
  if (!id) throw new VibyAssertionError("missing_assertion", "Missing Viby assertion ID.");
  if (options.confidential && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    throw new VibyAssertionError("invalid_payload", "The Viby assertion identifier is invalid.");
  }

  const assertionUrl = options.confidential
    ? `${vibyBaseUrl({ allowDefault: false })}/api/identity/assertions/redeem`
    : `${vibyBaseUrl({ allowDefault: false })}/api/identity/assertions/${encodeURIComponent(id)}`;
  if (options.confidential && isProductionSafeRuntime() && new URL(assertionUrl).protocol !== "https:") {
    throw new VibyAssertionError("missing_config", "Confidential Viby redemption requires the configured HTTPS environment.");
  }
  let response: Response;
  try {
    const clientSecret = process.env.VIBY_CLIENT_SECRET?.trim();
    if (options.confidential && !clientSecret) {
      throw new VibyAssertionError("missing_config", "VIBY_CLIENT_SECRET is required for unified Viby login.");
    }
    response = await fetch(assertionUrl, {
      cache: "no-store",
      ...(options.confidential ? {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${vibyAppSlug()}:${clientSecret}`).toString("base64")}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ assertion_id: id }),
        redirect: "manual",
      } : {}),
    });
  } catch (error) {
    if (error instanceof VibyAssertionError) throw error;
    throw new VibyAssertionError("viby_unavailable", "Viby is unavailable. Try again after Viby is running.");
  }

  if (response.status === 404) {
    throw new VibyAssertionError("assertion_not_found", "That Viby assertion was not found.");
  }
  if (response.status === 410) {
    throw new VibyAssertionError("assertion_expired", "That Viby assertion is expired.");
  }
  if (response.status === 409) {
    throw new VibyAssertionError("assertion_consumed", "That Viby assertion has already been used.");
  }
  if (!response.ok) {
    throw new VibyAssertionError("viby_unavailable", "Viby could not verify the assertion.");
  }

  const data = await parseJsonResponse(response);
  if (options.confidential && data.assertion?.id !== id) {
    throw new VibyAssertionError("invalid_payload", "Viby returned a mismatched assertion.");
  }
  if (options.confidential) {
    let returnedState: string | null = null;
    try {
      returnedState = data.assertion?.returnTo
        ? new URL(data.assertion.returnTo).searchParams.get("state")
        : null;
    } catch {
      // Rejected by the exact comparison below.
    }
    if (!options.expectedCallbackState || returnedState !== options.expectedCallbackState) {
      throw new VibyAssertionError("wrong_context", "The assertion is not bound to this callback transaction.");
    }
  }
  const expectedAudience = vibyAppSlug();
  const assertionAudience = data.assertion?.audience ?? null;
  const payloadAudience = data.payload?.audience ?? null;
  if (assertionAudience !== expectedAudience || payloadAudience !== expectedAudience) {
    throw new VibyAssertionError("wrong_audience", `This assertion is not scoped to ${expectedAudience}.`);
  }

  if (data.assertion?.type !== "host_app_entry" || data.payload?.subject_type !== "human") {
    throw new VibyAssertionError("wrong_context", "Only a human host application assertion can establish an interactive application session.");
  }
  if (data.effectiveMode !== VIBY_ADMIN_MODE || data.assertion.effectiveMode !== VIBY_ADMIN_MODE) {
    throw new VibyAssertionError("wrong_context", "The assertion was not issued for the registered application mode.");
  }
  if (!data.payload.issued_at || !data.payload.expires_at) {
    throw new VibyAssertionError("invalid_payload", "Viby omitted mandatory assertion timing.");
  }
  const expiresAtMs = data.assertion.expiresAt ?? null;
  const payloadExpiresAt = Date.parse(data.payload.expires_at);
  if (!Number.isFinite(payloadExpiresAt) || payloadExpiresAt <= Date.now() || (expiresAtMs !== null && expiresAtMs !== payloadExpiresAt)) {
    throw new VibyAssertionError("assertion_expired", "That Viby assertion is expired.");
  }
  const payloadIssuedAt = Date.parse(data.payload.issued_at);
  if (!Number.isFinite(payloadIssuedAt) || payloadIssuedAt > Date.now() + 30_000 || payloadIssuedAt >= payloadExpiresAt) {
    throw new VibyAssertionError("invalid_payload", "Viby returned an invalid assertion issue time.");
  }

  const vibyUserId = data.payload?.user_id ?? data.user?.id;
  const displayName = data.payload?.display_name ?? data.user?.displayName;
  if (!vibyUserId || !displayName) {
    throw new VibyAssertionError("invalid_payload", "Viby returned an assertion without a user identity.");
  }
  if (typeof vibyUserId !== "string" || typeof displayName !== "string") {
    throw new VibyAssertionError("invalid_payload", "Viby returned an invalid user identity.");
  }
  const method = data.payload?.method ?? data.identity?.method ?? null;
  const confidence = data.payload?.confidence ?? data.identity?.confidence ?? null;
  if (!method || typeof method !== "string" || !validConfidence(confidence)) {
    throw new VibyAssertionError("invalid_payload", "Viby returned an assertion without a valid identity method.");
  }

  const context = data.payload?.context ?? null;
  if (context !== null && !isObject(context)) {
    throw new VibyAssertionError("invalid_payload", "Viby returned invalid assertion context.");
  }
  const identitySessionId = data.identity?.sessionId;
  const payloadSessionId = data.payload.session_id;
  if (!identitySessionId || payloadSessionId !== identitySessionId) {
    throw new VibyAssertionError("invalid_payload", "Viby returned inconsistent identity-session provenance.");
  }
  const verifiedAt = data.identity?.verifiedAt;
  const verifiedAtMs = verifiedAt ? Date.parse(verifiedAt) : Number.NaN;
  if (
    !verifiedAt ||
    !Number.isFinite(verifiedAtMs) ||
    (data.identity?.verificationKind !== "fresh" && data.identity?.verificationKind !== "remembered") ||
    typeof data.identity?.freshVerification !== "boolean" ||
    (data.identity.verificationKind === "fresh") !== data.identity.freshVerification
  ) {
    throw new VibyAssertionError("invalid_payload", "Viby returned invalid identity-verification provenance.");
  }
  if (options.requireFresh && !hasCurrentFreshVibyEvidence({
    freshVerification: data.identity?.freshVerification === true,
    verificationKind: data.identity?.verificationKind === "fresh" ? "fresh" : "remembered",
    verifiedAt: verifiedAt ?? "",
  })) {
    throw new VibyAssertionError("wrong_context", "Viby did not provide current authoritative fresh-verification evidence.");
  }

  return {
    assertionId: data.assertion?.id ?? id,
    audience: expectedAudience,
    vibyUserId,
    displayName,
    tag: data.payload?.tag ?? data.user?.tag ?? null,
    affiliation: data.payload?.affiliation ?? data.user?.affiliation ?? null,
    method,
    confidence,
    sessionId: identitySessionId,
    verifiedAt,
    freshVerification: data.identity?.freshVerification === true,
    verificationKind: data.identity?.verificationKind === "fresh" ? "fresh" : "remembered",
    effectiveMode: data.effectiveMode,
    issuedAt: data.payload.issued_at,
    expiresAt: data.payload.expires_at,
    context,
    returnTo: data.assertion?.returnTo ?? null,
  };
}

export async function verifyVibyAgentAttributionAssertion(assertionId: string): Promise<VibyAgentAssertion> {
  const id = assertionId.trim();
  if (!id) throw new VibyAssertionError("missing_assertion", "Missing Viby assertion ID.");

  const assertionUrl = `${vibyBaseUrl({ allowDefault: false })}/api/identity/assertions/${encodeURIComponent(id)}`;
  let response: Response;
  try {
    response = await fetch(assertionUrl, { cache: "no-store" });
  } catch {
    throw new VibyAssertionError("viby_unavailable", "Viby is unavailable. Try again after Viby is running.");
  }

  if (response.status === 404) {
    throw new VibyAssertionError("assertion_not_found", "That Viby assertion was not found.");
  }
  if (response.status === 410) {
    throw new VibyAssertionError("assertion_expired", "That Viby assertion is expired.");
  }
  if (!response.ok) {
    throw new VibyAssertionError("viby_unavailable", "Viby could not verify the assertion.");
  }

  const data = await parseJsonResponse(response);
  const expectedAudience = vibyAppSlug();
  const assertionAudience = data.assertion?.audience ?? null;
  const payloadAudience = data.payload?.audience ?? null;
  if (assertionAudience !== expectedAudience || payloadAudience !== expectedAudience) {
    throw new VibyAssertionError("wrong_audience", `This assertion is not scoped to ${expectedAudience}.`);
  }

  const expiresAtMs = data.assertion?.expiresAt ?? null;
  const payloadExpiresAt = data.payload?.expires_at ? Date.parse(data.payload.expires_at) : null;
  if ((expiresAtMs && expiresAtMs <= Date.now()) || (payloadExpiresAt && payloadExpiresAt <= Date.now())) {
    throw new VibyAssertionError("assertion_expired", "That Viby assertion is expired.");
  }

  const context = data.payload?.context ?? null;
  if (context !== null && !isObject(context)) {
    throw new VibyAssertionError("invalid_payload", "Viby returned invalid assertion context.");
  }
  if (!context || context.mode !== "agent-attribution") {
    throw new VibyAssertionError("wrong_context", "This Viby assertion is not for agent attribution.");
  }

  if (data.payload?.subject_type !== "agent") {
    throw new VibyAssertionError("invalid_payload", "Viby returned a non-agent assertion.");
  }

  const agentId = data.payload.agent_id;
  const agentName = data.payload.agent_name;
  const agentDisplayName = data.payload.agent_display_name;
  const ownerVibyUserId = data.payload.owner_user_id;
  const ownerDisplayName = data.payload.owner_display_name;
  const delegationMethod = data.payload.delegation_method;
  if (
    typeof agentId !== "string" || !agentId ||
    typeof ownerVibyUserId !== "string" || !ownerVibyUserId ||
    delegationMethod !== "owner_registered"
  ) {
    throw new VibyAssertionError("invalid_payload", "Viby returned an invalid agent attribution assertion.");
  }

  const safeAgentName = typeof agentName === "string" && agentName.trim()
    ? agentName.trim()
    : `Agent ${agentId}`;
  const safeAgentDisplayName = typeof agentDisplayName === "string" && agentDisplayName.trim()
    ? agentDisplayName.trim()
    : safeAgentName;
  const safeOwnerDisplayName = typeof ownerDisplayName === "string" && ownerDisplayName.trim()
    ? ownerDisplayName.trim()
    : ownerVibyUserId;

  return {
    assertionId: data.assertion?.id ?? id,
    audience: expectedAudience,
    agentId,
    agentName: safeAgentName,
    agentDisplayName: safeAgentDisplayName,
    ownerVibyUserId,
    ownerDisplayName: safeOwnerDisplayName,
    delegationMethod,
    method: data.payload.method ?? data.identity?.method ?? null,
    issuedAt: data.payload.issued_at ?? null,
    expiresAt: data.payload.expires_at ?? (expiresAtMs ? new Date(expiresAtMs).toISOString() : null),
    context,
  };
}
