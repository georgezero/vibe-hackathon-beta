import { redirect } from "next/navigation";
import { headers } from "next/headers";
import type { AuthenticatedAccountDisplay } from "@/lib/application-account-display";
import { resolveJudgePrincipal } from "@/lib/judge-principal";
import { currentJudgingEventId } from "@/lib/judging-event";

export interface AuthorizedJudgePage {
  id: string;
  name: string;
  eventId: string;
  authentication: "better-auth";
  authenticatedAccount: AuthenticatedAccountDisplay | null;
}

function pageReason(status: "forbidden" | "unavailable") {
  return status === "unavailable" ? "unavailable" : "not_authorized";
}

export async function requireAuthorizedJudgePage(): Promise<AuthorizedJudgePage> {
  const resolution = await resolveJudgePrincipal(await headers(), {
    eventId: currentJudgingEventId(),
  });
  if (resolution.status === "authorized") {
    const { applicationPrincipal, judgeProfile, event } = resolution.principal;
    return {
      id: judgeProfile.id,
      name: judgeProfile.name,
      eventId: event.id,
      authentication: "better-auth",
      authenticatedAccount: {
        displayName: applicationPrincipal.user.name?.trim()
          || applicationPrincipal.user.email,
        roles: applicationPrincipal.roles,
      },
    };
  }
  if (resolution.status === "signed_out") {
    redirect("/judge?reason=session_required");
  }
  if (
    resolution.status === "forbidden"
    && resolution.reason === "password_change_required"
  ) {
    redirect("/account?password=required");
  }
  redirect(`/judge?reason=${pageReason(resolution.status)}`);
}
