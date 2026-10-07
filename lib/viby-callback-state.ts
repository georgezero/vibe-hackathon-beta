import { createHmac, randomUUID, timingSafeEqual } from "crypto";
import type { NextRequest, NextResponse } from "next/server";
import { isExplicitDevelopmentRuntime, isProductionSafeRuntime } from "./runtime-mode";

export const VIBY_CALLBACK_STATE_COOKIE = "vibe_viby_callback_state";
export const VIBY_CALLBACK_STATE_TTL_SECONDS = 10 * 60;

export type VibyCallbackFlow = "admin" | "agent" | "artifact";

export interface VibyCallbackState {
  state: string;
  flow: VibyCallbackFlow;
  callbackPath: string;
  returnTo: string;
  source: string;
  projectId?: string;
  artifactType?: string;
  expiresAt: number;
}

function secret() {
  const configured = process.env.VIBY_CALLBACK_STATE_SECRET?.trim();
  if (configured) {
    if (isProductionSafeRuntime() && configured.length < 32) throw new Error("VIBY_CALLBACK_STATE_SECRET is not configured.");
    return configured;
  }
  if (isExplicitDevelopmentRuntime() || process.env.NODE_ENV === "test") {
    const developmentSecret = process.env.BETTER_AUTH_SECRET?.trim();
    if (developmentSecret) return developmentSecret;
  }
  throw new Error("VIBY_CALLBACK_STATE_SECRET is not configured.");
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function encode(state: VibyCallbackState) {
  const payload = Buffer.from(JSON.stringify(state)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function decode(value: string): VibyCallbackState | null {
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return null;
  const expected = sign(payload);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as VibyCallbackState;
    if (!parsed.state || !parsed.flow || !parsed.callbackPath || !parsed.returnTo || !parsed.source) return null;
    if (!Number.isFinite(parsed.expiresAt) || parsed.expiresAt <= Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function issueVibyCallbackState(input: Omit<VibyCallbackState, "state" | "expiresAt">) {
  const state: VibyCallbackState = {
    ...input,
    state: randomUUID(),
    expiresAt: Date.now() + VIBY_CALLBACK_STATE_TTL_SECONDS * 1000,
  };
  return { state, cookieValue: encode(state) };
}

export function validateVibyCallbackState(
  request: NextRequest,
  expectedFlow: VibyCallbackFlow,
  expectedCallbackPath: string,
  stateOverride?: string | null,
) {
  const queryState = stateOverride ?? request.nextUrl.searchParams.get("state");
  const cookieState = request.cookies.get(VIBY_CALLBACK_STATE_COOKIE)?.value;
  if (!queryState || !cookieState) return null;
  let decoded: VibyCallbackState | null = null;
  try {
    decoded = decode(cookieState);
  } catch {
    return null;
  }
  if (!decoded || decoded.state !== queryState || decoded.flow !== expectedFlow || decoded.callbackPath !== expectedCallbackPath) return null;
  return decoded;
}

export function setVibyCallbackStateCookie(response: NextResponse, cookieValue: string) {
  response.cookies.set(VIBY_CALLBACK_STATE_COOKIE, cookieValue, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.VIBE_HACKATHON_BASE_URL?.startsWith("https://") === true,
    path: "/",
    maxAge: VIBY_CALLBACK_STATE_TTL_SECONDS,
  });
}

export function clearVibyCallbackStateCookie(response: NextResponse) {
  response.cookies.set(VIBY_CALLBACK_STATE_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.VIBE_HACKATHON_BASE_URL?.startsWith("https://") === true,
    path: "/",
    maxAge: 0,
  });
}
