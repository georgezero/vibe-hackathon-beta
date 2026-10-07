import { NextRequest, NextResponse } from "next/server";
import { getBaseUrl } from "@/lib/base-url";
import {
  ACCOUNT_INVITATION_COOKIE,
} from "@/lib/account-invitations";
import { createInvitationVibyTransaction } from "@/lib/account-invitation-viby";
import { strictSameOriginFailure } from "@/lib/same-origin";
import { vibyAppSlug, vibyBaseUrl } from "@/lib/viby";
import {
  VIBY_BROWSER_BINDING_COOKIE,
} from "@/lib/viby-login-transactions";
import {
  VIBY_RUNTIME_CALLBACK_PATH,
  VIBY_RUNTIME_MODE,
  VIBY_RUNTIME_SOURCE,
} from "@/lib/viby-login-policy";
import { beginFreshVibySignIn } from "@/lib/fresh-viby-sign-in";

export async function POST(request: NextRequest) {
  const baseUrl = getBaseUrl();
  if (strictSameOriginFailure(request, new URL(baseUrl).origin)) {
    return NextResponse.json({ error: "The request origin is not allowed." }, { status: 403 });
  }
  const token = request.cookies.get(ACCOUNT_INVITATION_COOKIE)?.value ?? "";
  return beginFreshVibySignIn(request, {
    operation: "invitation_acceptance",
    preserveCookies: [ACCOUNT_INVITATION_COOKIE],
    createLaunchResponse: async () => {
      const issued = await createInvitationVibyTransaction(token);
      if (!issued) return NextResponse.redirect(new URL("/invite/accept?status=invalid", baseUrl), 303);
      const callback = new URL(VIBY_RUNTIME_CALLBACK_PATH, baseUrl);
      callback.searchParams.set("state", issued.state);
      const startUrl = new URL(`/apps/${vibyAppSlug()}/start`, vibyBaseUrl({ allowDefault: false }));
      startUrl.searchParams.set("mode", VIBY_RUNTIME_MODE);
      startUrl.searchParams.set("callbackUrl", callback.toString());
      startUrl.searchParams.set("context", JSON.stringify({
        mode: VIBY_RUNTIME_MODE,
        source: VIBY_RUNTIME_SOURCE,
        forceIdentityCheck: true,
      }));
      startUrl.searchParams.set("freshIdentity", "1");
      const response = NextResponse.redirect(startUrl, 303);
      response.cookies.set(VIBY_BROWSER_BINDING_COOKIE, issued.browserBinding, {
        httpOnly: true,
        sameSite: "lax",
        secure: baseUrl.startsWith("https://"),
        path: "/",
        maxAge: 10 * 60,
      });
      return response;
    },
  });
}
