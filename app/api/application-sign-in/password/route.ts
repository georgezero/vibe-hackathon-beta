import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { canonicalizeConfiguredBaseUrl, getBaseUrl } from "@/lib/base-url";
import { db } from "@/lib/db";
import { sessions } from "@/lib/db/schema";
import { strictSameOriginFailure } from "@/lib/same-origin";
import { passwordCallbackReturnTo } from "@/lib/login-routing";

type SignInBody = {
  email?: unknown;
  password?: unknown;
  callbackURL?: unknown;
};

function failureResponse(origin: string, callbackURL: string | null, formSubmission: boolean) {
  if (!formSubmission) {
    return NextResponse.json(
      { error: "Unable to sign in with those credentials." },
      { status: 401, headers: { "Cache-Control": "no-store, private", "Referrer-Policy": "no-referrer" } },
    );
  }

  const redirectURL = new URL(callbackURL ?? "/login", origin);
  redirectURL.searchParams.set("reason", "invalid_credentials");
  const response = NextResponse.redirect(redirectURL, 303);
  response.headers.set("Cache-Control", "no-store, private");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

export async function POST(request: NextRequest) {
  const origin = canonicalizeConfiguredBaseUrl(getBaseUrl());
  if (strictSameOriginFailure(request, origin)) {
    return NextResponse.json({ error: "The request origin is not allowed." }, { status: 403 });
  }
  const contentType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  const formSubmission = contentType === "application/x-www-form-urlencoded" || contentType === "multipart/form-data";
  const parsedBody = contentType === "application/json"
    ? await request.json().catch(() => null) as SignInBody | null
    : formSubmission
      ? await request.formData().then((form) => ({
      email: form.get("email"),
      password: form.get("password"),
      callbackURL: form.get("callbackURL"),
      })).catch(() => null) as SignInBody | null
      : null;
  const callbackURL = typeof parsedBody?.callbackURL === "string"
    ? passwordCallbackReturnTo(parsedBody.callbackURL)
    : null;
  if (
    typeof parsedBody?.email !== "string"
    || typeof parsedBody.password !== "string"
    || !callbackURL
  ) {
    return NextResponse.json({ error: "Invalid sign-in request." }, { status: 400 });
  }

  // A failed credential check leaves the existing application session intact.
  const current = await auth.api.getSession({ headers: request.headers });
  try {
    const signedIn = await auth.api.signInEmail({
      headers: request.headers,
      body: { email: parsedBody.email.trim(), password: parsedBody.password },
      asResponse: true,
    });
    if (!signedIn.ok) {
      return failureResponse(origin, callbackURL, formSubmission);
    }
    if (current?.session.id) {
      db.delete(sessions).where(eq(sessions.id, current.session.id)).run();
    }
    const response = formSubmission
      ? NextResponse.redirect(new URL(callbackURL, origin), 303)
      : NextResponse.json({ success: true, callbackURL });
    for (const cookie of signedIn.headers.getSetCookie()) {
      response.headers.append("set-cookie", cookie);
    }
    response.headers.set("Cache-Control", "no-store, private");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  } catch {
    return failureResponse(origin, callbackURL, formSubmission);
  }
}
