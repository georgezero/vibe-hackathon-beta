import { CommunityChannelError } from "@/lib/community-channels";

/**
 * Community pages intentionally do not distinguish an unavailable channel
 * from an account that is not eligible for the event conversation.
 */
export function isCommunityRouteNotFound(error: unknown) {
  return error instanceof CommunityChannelError && (
    error.code === "channel_not_found" ||
    error.code === "participant_required" ||
    error.code === "channel_forbidden"
  );
}
