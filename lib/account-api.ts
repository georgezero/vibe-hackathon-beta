import { NextRequest, NextResponse } from "next/server";
import { getBaseUrl } from "@/lib/base-url";
import {
  isRecentAdministratorAuthentication,
} from "@/lib/account-management";
import {
  resolveApplicationPrincipal,
  type ApplicationPrincipal,
} from "@/lib/application-principal";
import { strictSameOriginFailure } from "@/lib/same-origin";

export function accountMutationOriginFailure(request: NextRequest) {
  return strictSameOriginFailure(request, new URL(getBaseUrl()).origin);
}

export async function requireAccountPrincipal(
  request: NextRequest,
  context: { eventId?: string } = {},
): Promise<
  | { ok: true; principal: ApplicationPrincipal }
  | { ok: false; response: NextResponse }
> {
  const resolution = await resolveApplicationPrincipal(request.headers, context);
  if (resolution.status === "unauthenticated") {
    return {
      ok: false,
      response: NextResponse.json({ error: "Authentication required." }, { status: 401 }),
    };
  }
  if (resolution.status !== "authenticated") {
    return {
      ok: false,
      response: NextResponse.json({ error: "The account state is unavailable." }, { status: 403 }),
    };
  }
  return { ok: true, principal: resolution.principal };
}

export async function requireRecentAccountAdministrator(
  request: NextRequest,
  context: { eventId?: string } = {},
) {
  const authenticated = await requireAccountPrincipal(request, context);
  if (!authenticated.ok) return authenticated;
  if (
    !authenticated.principal.roles.isAdmin
    || !authenticated.principal.authorizations.admin
  ) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Administrator access required." }, { status: 403 }),
    };
  }
  if (!isRecentAdministratorAuthentication(authenticated.principal.session.createdAt)) {
    return {
      ok: false as const,
      response: NextResponse.json({
        error: "Recent administrator authentication is required. Sign out and sign in again.",
        code: "recent_authentication_required",
      }, { status: 403 }),
    };
  }
  return authenticated;
}
