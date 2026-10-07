import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { resolveLiveAdminAuthorization } from "./application-principal";
import { db } from "./db";
import { vibyIdentityLinks } from "./db/schema";

export async function isAuthorizedAdminVibyUser(subjectId: string) {
  try {
    const links = await db.select({ userId: vibyIdentityLinks.localUserId })
      .from(vibyIdentityLinks)
      .where(and(
        eq(vibyIdentityLinks.providerId, "viby"),
        eq(vibyIdentityLinks.applicationId, "vibe-hackathon"),
        eq(vibyIdentityLinks.subjectId, subjectId),
        eq(vibyIdentityLinks.status, "active"),
        isNull(vibyIdentityLinks.revokedAt),
        isNotNull(vibyIdentityLinks.localUserId),
      ))
      .limit(2);
    if (links.length !== 1 || !links[0].userId) return false;
    const authorization = await resolveLiveAdminAuthorization(links[0].userId);
    return authorization.status === "active";
  } catch {
    // Authorization is fail-closed if the additive schema is unavailable.
    return false;
  }
}
