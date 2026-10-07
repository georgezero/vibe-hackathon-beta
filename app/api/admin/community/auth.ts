import { isRecentAdministratorAuthentication } from "@/lib/account-management";
import type { AdminApiAuthorization } from "@/lib/admin-api";

/** Keep the existing recent-admin-authentication boundary on F.3 actions. */
export function recentCommunityAdminUserId(authorization: AdminApiAuthorization) {
  const session = authorization.session;
  if (!session?.local_user_id) return null;
  return isRecentAdministratorAuthentication(new Date(session.issued_at))
    ? session.local_user_id
    : null;
}
