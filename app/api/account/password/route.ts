import { APIError } from "better-auth/api";
import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import {
  accountMutationOriginFailure,
  requireAccountPrincipal,
} from "@/lib/account-api";
import { completePasswordChange } from "@/lib/account-management";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { accounts } from "@/lib/db/schema";

export async function POST(request: NextRequest) {
  if (accountMutationOriginFailure(request)) {
    return NextResponse.json({ error: "The request origin is not allowed." }, { status: 403 });
  }
  const authenticated = await requireAccountPrincipal(request);
  if (!authenticated.ok) return authenticated.response;
  const body = await request.json().catch(() => null) as {
    currentPassword?: unknown;
    newPassword?: unknown;
  } | null;
  if (
    !body
    || typeof body.newPassword !== "string"
    || body.newPassword.length < 8
    || body.newPassword.length > 128
  ) {
    return NextResponse.json({ error: "Use a password between 8 and 128 characters." }, { status: 400 });
  }
  const credentialRows = db.select({
    id: accounts.id,
    password: accounts.password,
  }).from(accounts).where(and(
    eq(accounts.userId, authenticated.principal.user.id),
    eq(accounts.providerId, "credential"),
  )).limit(2).all();
  if (credentialRows.length > 1) {
    return NextResponse.json({
      error: "The credential state is ambiguous and was not changed.",
    }, { status: 409 });
  }
  const hasPassword = Boolean(credentialRows[0]?.password);
  try {
    if (hasPassword) {
      if (typeof body.currentPassword !== "string" || !body.currentPassword) {
        return NextResponse.json({ error: "Current password is required." }, { status: 400 });
      }
      await auth.api.changePassword({
        headers: request.headers,
        body: {
          currentPassword: body.currentPassword,
          newPassword: body.newPassword,
          revokeOtherSessions: false,
        },
      });
    } else {
      await auth.api.setPassword({
        headers: request.headers,
        body: { newPassword: body.newPassword },
      });
    }
    completePasswordChange(authenticated.principal.user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof APIError && error.status === "BAD_REQUEST"
      ? "The current password is incorrect or the new password is not accepted."
      : "Password update failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
