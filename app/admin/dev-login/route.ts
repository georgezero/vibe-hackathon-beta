import { NextRequest, NextResponse } from "next/server";
import { createAdminSessionCookie } from "@/lib/admin-session";
import { logAdminAudit } from "@/lib/admin-audit";
import { isExplicitDevelopmentRuntime } from "@/lib/runtime-mode";

function wantsJson(req: NextRequest) {
  return req.headers.get("accept")?.includes("application/json");
}

function getPublicBaseUrl(req: NextRequest) {
  return (process.env.VIBE_HACKATHON_BASE_URL ?? req.nextUrl.origin).replace(/\/$/, "");
}

function deny(req: NextRequest, message: string) {
  if (wantsJson(req)) {
    return NextResponse.json({ ok: false, message }, { status: 403 });
  }

  const publicBaseUrl = getPublicBaseUrl(req);
  const redirectUrl = new URL("/admin", publicBaseUrl);
  redirectUrl.searchParams.set("viby_status", "error");
  redirectUrl.searchParams.set("viby_message", message);
  return NextResponse.redirect(redirectUrl);
}

export async function POST(req: NextRequest) {
  if (!isExplicitDevelopmentRuntime() || process.env.VIBE_ENABLE_ADMIN_DEV_FALLBACK !== "true") {
    return deny(req, "Development fallback is not enabled.");
  }

  const form = await req.formData();
  const token = String(form.get("token") ?? "").trim();
  const expected = process.env.ADMIN_TOKEN?.trim();

  if (!expected) {
    if (wantsJson(req)) {
      return NextResponse.json(
        { ok: false, message: "Development fallback is not configured." },
        { status: 503 },
      );
    }
    return deny(req, "Development fallback is not configured.");
  }

  if (token !== expected) {
    return deny(req, "Invalid development admin token.");
  }

  await createAdminSessionCookie({
    vibyUserId: "dev_fallback",
    displayName: "Development Admin",
    identityMethod: "development_fallback",
    identityConfidence: null,
  });
  await logAdminAudit("viby_admin_dev_session_created", {
    reason: "explicit_dev_fallback",
  });

  if (wantsJson(req)) {
    return NextResponse.json({ ok: true });
  }

  return NextResponse.redirect(new URL("/admin/dashboard", getPublicBaseUrl(req)));
}
