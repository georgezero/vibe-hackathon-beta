import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getBaseUrl } from "@/lib/base-url";
import { strictSameOriginFailure } from "@/lib/same-origin";
import {
  confirmPendingVibyLink,
  VIBY_LINK_BINDING_COOKIE,
  VIBY_LINK_TOKEN_COOKIE,
} from "@/lib/viby-interactive-linking";
import { logAdminAudit } from "@/lib/admin-audit";

export async function POST(req: NextRequest) {
  const origin = new URL(getBaseUrl()).origin;
  if (strictSameOriginFailure(req, origin)) return NextResponse.json({ error: "Origin denied." }, { status: 403 });
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) return NextResponse.redirect(new URL("/admin/link-viby", origin), 303);
  const token = req.cookies.get(VIBY_LINK_TOKEN_COOKIE)?.value ?? "";
  const binding = req.cookies.get(VIBY_LINK_BINDING_COOKIE)?.value ?? "";
  const result = token && binding ? await confirmPendingVibyLink({
    token,
    browserBinding: binding,
    userId: session.user.id,
    betterAuthSessionId: session.session.id,
  }) : { ok: false as const, reason: "invalid_transaction" as const };
  if (!result.ok) {
    await logAdminAudit("viby_identity_link_failed", { reason: result.reason });
    return NextResponse.redirect(new URL(`/admin/link-viby?reason=${encodeURIComponent(result.reason)}`, origin), 303);
  }
  await logAdminAudit(
    result.claimType === "claim_unbound_legacy_link"
      ? "viby_legacy_identity_claim_confirmed"
      : "viby_identity_link_confirmed",
    {
    correlation_id: result.link.id,
    idempotent: result.idempotent,
    reason: result.claimType,
    },
  );
  const response = NextResponse.redirect(new URL(result.returnTo, origin), 303);
  response.cookies.delete(VIBY_LINK_TOKEN_COOKIE);
  response.cookies.delete(VIBY_LINK_BINDING_COOKIE);
  return response;
}
