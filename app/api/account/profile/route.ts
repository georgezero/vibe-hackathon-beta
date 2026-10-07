import { NextRequest, NextResponse } from "next/server";
import {
  accountMutationOriginFailure,
  requireAccountPrincipal,
} from "@/lib/account-api";
import {
  AccountManagementError,
  updateOwnName,
} from "@/lib/account-management";
import {
  ensureOwnProfile,
  ProfileDomainError,
  toProfileEditorData,
  updateOwnProfile,
} from "@/lib/user-profiles";

const PROFILE_FIELDS = [
  "handle",
  "displayName",
  "headline",
  "bio",
  "affiliation",
  "degrees",
  "websiteUrl",
  "githubUrl",
  "linkedinUrl",
  "interests",
  "visibility",
  "discoverable",
] as const;

type ProfilePayload = Partial<Record<(typeof PROFILE_FIELDS)[number], unknown>> & { name?: unknown };

function profileError(error: unknown) {
  if (error instanceof ProfileDomainError) {
    const messages: Record<string, string> = {
      invalid_handle: "Use 3–30 lowercase letters, numbers, or hyphens.",
      reserved_handle: "That profile address is reserved.",
      handle_taken: "That profile address is already taken.",
      invalid_display_name: "Enter a display name between 2 and 100 characters.",
      invalid_url: "Enter a valid website, GitHub, or LinkedIn URL.",
      invalid_visibility: "Choose Private or Public.",
      invalid_profile_field: "Check the highlighted profile fields and try again.",
    };
    return { error: messages[error.code] ?? "Profile update failed.", code: error.code };
  }
  if (error instanceof AccountManagementError && error.code === "invalid_name") {
    return { error: "Enter a valid display name.", code: error.code };
  }
  return { error: "Profile update failed.", code: "profile_update_failed" };
}

export async function GET(request: NextRequest) {
  const authenticated = await requireAccountPrincipal(request);
  if (!authenticated.ok) return authenticated.response;
  const profile = await ensureOwnProfile(authenticated.principal.user.id);
  return NextResponse.json({ profile: toProfileEditorData(profile) });
}

export async function PATCH(request: NextRequest) {
  if (accountMutationOriginFailure(request)) {
    return NextResponse.json({ error: "The request origin is not allowed." }, { status: 403 });
  }
  const authenticated = await requireAccountPrincipal(request);
  if (!authenticated.ok) return authenticated.response;
  const body = await request.json().catch(() => null) as ProfilePayload | null;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Profile details are required.", code: "invalid_profile_field" }, { status: 400 });
  }

  // Keep the legacy display-name payload working for existing Account clients.
  // The F.0B editor sends displayName and never mutates Better Auth users.name.
  if (Object.keys(body).length === 1 && typeof body.name === "string") {
    try {
      updateOwnName(authenticated.principal.user.id, body.name);
      return NextResponse.json({ success: true });
    } catch (error) {
      return NextResponse.json(profileError(error), { status: 400 });
    }
  }

  const input = Object.fromEntries(
    PROFILE_FIELDS.filter((field) => Object.prototype.hasOwnProperty.call(body, field))
      .map((field) => [field, body[field]]),
  ) as Parameters<typeof updateOwnProfile>[1];
  if (Object.keys(input).length === 0) {
    return NextResponse.json({ error: "Profile details are required.", code: "invalid_profile_field" }, { status: 400 });
  }
  try {
    const profile = await updateOwnProfile(authenticated.principal.user.id, input);
    return NextResponse.json({ success: true, profile: toProfileEditorData(profile) });
  } catch (error) {
    const status = error instanceof ProfileDomainError && error.code === "handle_taken" ? 409 : 400;
    return NextResponse.json(profileError(error), { status });
  }
}
