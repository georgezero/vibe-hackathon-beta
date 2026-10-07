import { NextRequest, NextResponse } from "next/server";
import { applyApplicationLogout } from "@/lib/application-logout";
import { canonicalizeConfiguredBaseUrl } from "@/lib/base-url";
import { resolveApplicationPrincipal } from "@/lib/application-principal";
import { currentJudgingEventId } from "@/lib/judging-event";
import { logAdminAudit } from "@/lib/admin-audit";
import { logJudgeAudit } from "@/lib/judge-audit";
import { strictSameOriginFailure } from "@/lib/same-origin";

function applicationOrigin(request: NextRequest) {
  return canonicalizeConfiguredBaseUrl(
    process.env.VIBE_HACKATHON_BASE_URL ?? request.nextUrl.origin,
  );
}

export async function GET(request: NextRequest) {
  return NextResponse.redirect(new URL("/", applicationOrigin(request)), 303);
}

export async function POST(request: NextRequest) {
  const origin = applicationOrigin(request);
  if (strictSameOriginFailure(request, origin)) {
    return NextResponse.json(
      { error: "The request origin is not allowed." },
      { status: 403 },
    );
  }

  const principal = await resolveApplicationPrincipal(request.headers, {
    eventId: currentJudgingEventId(),
  });
  const response = NextResponse.redirect(new URL("/?signed_out=1", origin), 303);
  await applyApplicationLogout(request, response);

  if (principal.status === "authenticated") {
    if (principal.principal.roles.isAdmin) {
      await logAdminAudit("viby_admin_logout", { reason: "application_logout" });
    }
    if (principal.principal.roles.isJudge) {
      await logJudgeAudit("judge_logout", {
        userId: principal.principal.user.id,
        judgeId: principal.principal.authorizations.judge?.judge.id,
        authorizationId: principal.principal.authorizations.judge?.id,
        eventId: currentJudgingEventId(),
        route: "POST /logout",
        mode: "better-auth",
      });
    }
  }
  return response;
}
