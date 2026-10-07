import type { ApplicationPrincipal } from "@/lib/application-principal";

const allowedExact = new Set([
  "/account",
  "/account/projects",
  "/claim/confirm",
  "/admin",
  "/admin/dashboard",
  "/admin/link-viby",
  "/judge",
  "/judge/dashboard",
  "/judge/link-viby",
  "/login/link-viby",
  "/login",
  "/projects/join",
]);

function isAllowedPath(pathname: string) {
  return allowedExact.has(pathname)
    || pathname.startsWith("/admin/dashboard/")
    || pathname.startsWith("/judge/dashboard/")
    || pathname.startsWith("/judge/submissions/")
    || pathname.startsWith("/judge/projects/")
    || pathname.startsWith("/projects/join/");
}

export function safeLoginReturnTo(value: string | null | undefined): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  try {
    const parsed = new URL(value, "https://application.invalid");
    if (parsed.origin !== "https://application.invalid" || !isAllowedPath(parsed.pathname)) return null;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}

export function loginContext(returnTo: string | null) {
  if (!returnTo) return null;
  if (returnTo.startsWith("/admin")) return "Sign in to continue to the administrator dashboard.";
  if (returnTo.startsWith("/judge")) return "Sign in to continue judging.";
  if (returnTo.startsWith("/account")) return "Sign in to manage your account.";
  if (returnTo.startsWith("/claim")) return "Sign in to claim your submission.";
  if (returnTo === "/projects/join" || returnTo.startsWith("/projects/join/")) return "Sign in to join your project team.";
  return null;
}

export function roleLanding(principal: ApplicationPrincipal) {
  if (principal.roles.isAdmin && !principal.roles.isJudge) return "/admin/dashboard";
  if (principal.roles.isJudge && !principal.roles.isAdmin) return "/judge/dashboard";
  return "/account/projects";
}

export function destinationAuthorized(
  principal: ApplicationPrincipal,
  returnTo: string | null,
) {
  if (!returnTo || returnTo === "/login") return true;
  if (returnTo.startsWith("/admin")) return principal.roles.isAdmin;
  if (returnTo.startsWith("/judge")) return principal.roles.isJudge;
  if (returnTo.startsWith("/account")) return true;
  if (returnTo.startsWith("/claim")) return true;
  if (returnTo === "/projects/join" || returnTo.startsWith("/projects/join/")) return true;
  return false;
}

export function landingForPrincipal(
  principal: ApplicationPrincipal,
  returnTo: string | null,
) {
  return destinationAuthorized(principal, returnTo) && returnTo && returnTo !== "/login"
    ? returnTo
    : roleLanding(principal);
}

export function passwordCallbackReturnTo(value: string | null | undefined) {
  return safeLoginReturnTo(value) ?? "/login";
}
