import { NextRequest, NextResponse } from "next/server";
import { accountMutationOriginFailure, requireAccountPrincipal } from "@/lib/account-api";
import { DirectMessagingError, getMessagingPreference, updateMessagingPreference } from "@/lib/direct-messaging";

export async function GET(request: NextRequest) {
  const authenticated = await requireAccountPrincipal(request); if (!authenticated.ok) return authenticated.response;
  return NextResponse.json({ allowIncoming: await getMessagingPreference(authenticated.principal.user.id), deprecated: true });
}

export async function PATCH(request: NextRequest) {
  if (accountMutationOriginFailure(request)) return NextResponse.json({ error: "The request origin is not allowed." }, { status: 403 });
  const authenticated = await requireAccountPrincipal(request); if (!authenticated.ok) return authenticated.response;
  const body = await request.json().catch(() => null) as { allowIncoming?: unknown } | null;
  try { return NextResponse.json({ allowIncoming: await updateMessagingPreference(authenticated.principal.user.id, body?.allowIncoming), deprecated: true }); }
  catch (error) { return NextResponse.json({ error: error instanceof DirectMessagingError ? "Choose who can message you." : "Preference update failed." }, { status: 422 }); }
}
