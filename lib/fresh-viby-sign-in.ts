import { NextRequest, NextResponse } from "next/server";
import {
  applyApplicationLogoutState,
  invalidateApplicationSession,
} from "@/lib/application-logout";
import { VIBY_BROWSER_BINDING_COOKIE } from "@/lib/viby-login-transactions";

export const FRESH_VIBY_SIGN_IN_OPERATIONS = [
  "application_login",
  "admin_login",
  "judge_login",
  "invitation_acceptance",
] as const;

export type FreshVibySignInOperation =
  typeof FRESH_VIBY_SIGN_IN_OPERATIONS[number];

export async function beginFreshVibySignIn(
  request: NextRequest,
  input: {
    operation: FreshVibySignInOperation;
    preserveCookies?: readonly string[];
    createLaunchResponse: () => Promise<NextResponse>;
  },
) {
  if (!FRESH_VIBY_SIGN_IN_OPERATIONS.includes(input.operation)) {
    return NextResponse.json({ error: "Invalid Viby sign-in operation." }, { status: 400 });
  }

  // Deliberate order: invalidate and verify anonymity before creating state.
  const invalidation = await invalidateApplicationSession(request);
  const response = await input.createLaunchResponse();
  return applyApplicationLogoutState(request, response, invalidation, {
    preserve: [
      VIBY_BROWSER_BINDING_COOKIE,
      ...(input.preserveCookies ?? []),
    ],
  });
}
