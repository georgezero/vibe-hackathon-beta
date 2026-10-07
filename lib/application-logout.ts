import { NextRequest, NextResponse } from "next/server";
import { ACCOUNT_INVITATION_COOKIE } from "@/lib/account-invitations";
import { VIBY_CALLBACK_STATE_COOKIE } from "@/lib/viby-callback-state";
import {
  VIBY_BROWSER_BINDING_COOKIE,
  VIBY_HANDOFF_COOKIE,
} from "@/lib/viby-login-transactions";
import {
  VIBY_LINK_BINDING_COOKIE,
  VIBY_LINK_TOKEN_COOKIE,
} from "@/lib/viby-interactive-linking";

const fixedApplicationCookies = [
  "__Secure-better-auth.session_token",
  "__Secure-better-auth.session_data",
  "__Secure-better-auth.account_data",
  "__Secure-better-auth.dont_remember",
  "__Secure-better-auth.oauth_state",
  "better-auth.session_token",
  "better-auth.session_data",
  "better-auth.account_data",
  "better-auth.dont_remember",
  "better-auth.oauth_state",
  "vibe_admin_session",
  // Security tombstone: expire cookies issued by the retired judge HMAC flow.
  "vibe_judge_session",
  VIBY_CALLBACK_STATE_COOKIE,
  VIBY_BROWSER_BINDING_COOKIE,
  VIBY_HANDOFF_COOKIE,
  VIBY_LINK_TOKEN_COOKIE,
  VIBY_LINK_BINDING_COOKIE,
  ACCOUNT_INVITATION_COOKIE,
  // Pending submission-claim state is application-owned and must not survive
  // a full logout or account switch.
  "vibe_submission_claim",
  "vibe_submission_claim_binding",
] as const;

function isApplicationCookie(name: string) {
  return fixedApplicationCookies.includes(
    name as (typeof fixedApplicationCookies)[number],
  )
    || name.startsWith("__Secure-better-auth.session_data.")
    || name.startsWith("better-auth.session_data.")
    || name.startsWith("__Secure-better-auth.account_data.")
    || name.startsWith("better-auth.account_data.");
}

function expireApplicationCookie(response: NextResponse, name: string) {
  response.cookies.set(name, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: name.startsWith("__Secure-"),
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });
}

export interface ApplicationSessionInvalidation {
  setCookies: string[];
  previouslyAuthenticated: boolean;
}

export async function invalidateApplicationSession(
  request: NextRequest,
): Promise<ApplicationSessionInvalidation> {
  const { auth } = await import("@/lib/auth");
  const current = await auth.api.getSession({ headers: request.headers });
  const betterAuthResponse = await auth.api.signOut({
    headers: request.headers,
    asResponse: true,
  });
  const remaining = await auth.api.getSession({ headers: request.headers });
  if (remaining?.session) {
    throw new Error("Application session invalidation failed closed.");
  }
  return {
    setCookies: betterAuthResponse.headers.getSetCookie(),
    previouslyAuthenticated: Boolean(current?.session),
  };
}

export function applyApplicationLogoutState(
  request: NextRequest,
  response: NextResponse,
  invalidation: ApplicationSessionInvalidation,
  options: { preserve?: readonly string[] } = {},
) {
  for (const cookie of invalidation.setCookies) {
    response.headers.append("set-cookie", cookie);
  }

  const names = new Set<string>(fixedApplicationCookies);
  for (const cookie of request.cookies.getAll()) {
    if (isApplicationCookie(cookie.name)) names.add(cookie.name);
  }
  const preserved = new Set(options.preserve ?? []);
  for (const name of names) {
    if (!preserved.has(name)) expireApplicationCookie(response, name);
  }

  response.headers.set(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, private",
  );
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  return response;
}

export async function applyApplicationLogout(
  request: NextRequest,
  response: NextResponse,
  options: { preserve?: readonly string[] } = {},
) {
  const invalidation = await invalidateApplicationSession(request);
  return applyApplicationLogoutState(request, response, invalidation, options);
}
