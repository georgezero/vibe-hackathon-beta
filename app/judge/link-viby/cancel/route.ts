import { NextRequest, NextResponse } from "next/server";
import { getBaseUrl } from "@/lib/base-url";
import { logJudgeAudit } from "@/lib/judge-audit";
import { strictSameOriginFailure } from "@/lib/same-origin";
import {
  cancelPendingVibyLink,
  VIBY_LINK_BINDING_COOKIE,
  VIBY_LINK_TOKEN_COOKIE,
} from "@/lib/viby-interactive-linking";

export async function POST(req: NextRequest) {
  const origin = new URL(getBaseUrl()).origin;
  if (strictSameOriginFailure(req, origin)) {
    return NextResponse.json({ error: "Origin denied." }, { status: 403 });
  }
  const token = req.cookies.get(VIBY_LINK_TOKEN_COOKIE)?.value ?? "";
  const binding = req.cookies.get(VIBY_LINK_BINDING_COOKIE)?.value ?? "";
  if (token && binding) {
    await cancelPendingVibyLink(token, binding, "judge_login");
  }
  await logJudgeAudit("judge_viby_login_cancelled", {
    route: "/judge/link-viby",
  });
  const response = NextResponse.redirect(
    new URL("/judge?reason=link_cancelled", origin),
    303,
  );
  response.cookies.delete(VIBY_LINK_TOKEN_COOKIE);
  response.cookies.delete(VIBY_LINK_BINDING_COOKIE);
  return response;
}
