import { NextRequest, NextResponse } from "next/server";
import { canonicalizeConfiguredBaseUrl } from "@/lib/base-url";
import { createJudgeVibyStartResponse } from "@/lib/judge-viby-start";
import { strictSameOriginFailure } from "@/lib/same-origin";
import { beginFreshVibySignIn } from "@/lib/fresh-viby-sign-in";

export async function POST(request: NextRequest) {
  const origin = canonicalizeConfiguredBaseUrl(
    process.env.VIBE_HACKATHON_BASE_URL ?? request.nextUrl.origin,
  );
  if (strictSameOriginFailure(request, origin)) {
    return NextResponse.json(
      { error: "The request origin is not allowed." },
      { status: 403 },
    );
  }

  return beginFreshVibySignIn(request, {
    operation: "judge_login",
    createLaunchResponse: () => createJudgeVibyStartResponse(request, {
      freshnessRequired: true,
      reason: "account_switch",
      redirectStatus: 303,
    }),
  });
}
