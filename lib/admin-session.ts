import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { logAdminAudit } from "@/lib/admin-audit";
import {
  isExplicitDevelopmentRuntime,
  isProductionSafeRuntime,
} from "@/lib/runtime-mode";
import type { AdminPrincipal } from "@/lib/admin-principal";

export const ADMIN_SESSION_COOKIE = "vibe_admin_session";

export interface AdminSession {
  viby_user_id: string;
  display_name: string;
  role: "admin";
  issued_at: number;
  expires_at: number;
  identity_method: string | null;
  identity_confidence: number | null;
}

export class AdminSessionConfigurationError extends Error {}

export function adminSessionSigningSecret(explicitSecret?: string) {
  if (explicitSecret?.trim()) return explicitSecret;

  const configured = process.env.VIBE_ADMIN_SESSION_SECRET?.trim();
  if (configured) {
    if (isProductionSafeRuntime() && configured.length < 32) {
      throw new AdminSessionConfigurationError("Admin session signing is not configured.");
    }
    return configured;
  }

  if (isExplicitDevelopmentRuntime()) {
    const developmentSecret = process.env.BETTER_AUTH_SECRET?.trim();
    if (developmentSecret) return developmentSecret;
  }

  throw new AdminSessionConfigurationError("Admin session signing is not configured.");
}

export function adminSessionTtlSeconds() {
  const raw = Number(process.env.VIBE_ADMIN_SESSION_TTL_SECONDS ?? 43200);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 43200;
}

function shouldUseSecureCookie() {
  if (process.env.VIBE_ADMIN_COOKIE_SECURE === "true") return true;
  if (process.env.VIBE_ADMIN_COOKIE_SECURE === "false") {
    return !isExplicitDevelopmentRuntime();
  }
  if (isProductionSafeRuntime()) return true;
  return Boolean(process.env.VIBE_HACKATHON_BASE_URL?.startsWith("https://"));
}

function base64url(input: string | Buffer) {
  return Buffer.from(input).toString("base64url");
}

function signPayload(payload: string, secret?: string) {
  return createHmac("sha256", adminSessionSigningSecret(secret)).update(payload).digest("base64url");
}

export function encodeAdminSession(session: AdminSession, secret?: string) {
  const payload = base64url(JSON.stringify(session));
  return `${payload}.${signPayload(payload, secret)}`;
}

export function decodeAdminSession(value: string, secret?: string): AdminSession | null {
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return null;

  const expected = signPayload(payload, secret);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as AdminSession;
    if (parsed.role !== "admin") return null;
    if (!parsed.viby_user_id || !parsed.display_name || !parsed.issued_at || !parsed.expires_at) return null;
    if (parsed.expires_at <= Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function createAdminSessionCookie(input: {
  vibyUserId: string;
  displayName: string;
  identityMethod: string | null;
  identityConfidence: number | null;
}) {
  const now = Date.now();
  const ttlSeconds = adminSessionTtlSeconds();
  const session: AdminSession = {
    viby_user_id: input.vibyUserId,
    display_name: input.displayName.trim(),
    role: "admin",
    issued_at: now,
    expires_at: now + ttlSeconds * 1000,
    identity_method: input.identityMethod,
    identity_confidence: input.identityConfidence,
  };

  const jar = await cookies();
  jar.set(ADMIN_SESSION_COOKIE, encodeAdminSession(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookie(),
    path: "/",
    maxAge: ttlSeconds,
  });

  return session;
}

export async function clearAdminSessionCookie() {
  const jar = await cookies();
  jar.delete(ADMIN_SESSION_COOKIE);
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const jar = await cookies();
  const raw = jar.get(ADMIN_SESSION_COOKIE)?.value;
  if (!raw) return null;
  return decodeAdminSession(raw);
}

export async function requireAdminSession(): Promise<AdminPrincipal> {
  const { resolveAdminPrincipal } = await import("@/lib/admin-principal");
  const jar = await cookies();
  const headers = new Headers();
  headers.set("cookie", jar.toString());
  const resolution = await resolveAdminPrincipal(headers);
  if (resolution.status !== "authorized") {
    await logAdminAudit("admin_session_rejected", {
      reason: resolution.status === "forbidden"
        ? resolution.reason
        : "missing_invalid_or_expired_session",
    });
    if (
      resolution.status === "forbidden"
      && resolution.reason === "password_change_required"
    ) {
      redirect("/account?password=required");
    }
    redirect(`/admin?reason=${resolution.status === "forbidden" ? resolution.reason : "session_required"}`);
  }
  return resolution.principal;
}
