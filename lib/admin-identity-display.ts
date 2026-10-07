import type { AdminPrincipal } from "@/lib/admin-principal";

type AdminIdentityDisplayInput = Pick<
  AdminPrincipal,
  "authentication_mechanism" | "identity_method"
>;

export function adminSessionCaption(session: AdminIdentityDisplayInput) {
  if (session.authentication_mechanism === "viby") {
    return "Confirmed with Viby · Legacy application session";
  }
  if (session.identity_method === "better_auth_viby") {
    return "Confirmed with Viby · Better Auth session";
  }
  return "Signed in with Better Auth";
}
