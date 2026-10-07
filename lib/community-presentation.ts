/**
 * Presentation-only rules for the event conversation stream.
 *
 * A five-minute gap is long enough to make a resumed thought feel like a new
 * turn without splitting normal rapid-fire conversation into many groups.
 */
export const COMMUNITY_SENDER_GROUP_GAP_MS = 5 * 60 * 1000;

export type CommunityMessagePresentationInput = {
  createdAt: string;
  isRemoved: boolean;
  author: { displayName: string; handle: string | null };
};

export function communityMessageDateKey(value: string) {
  return new Date(value).toDateString();
}

function authorKey(author: CommunityMessagePresentationInput["author"]) {
  return author.handle || author.displayName.trim().toLocaleLowerCase();
}

export function isCommunityMessageContinuation(
  previous: CommunityMessagePresentationInput | undefined,
  current: CommunityMessagePresentationInput,
) {
  if (!previous || previous.isRemoved || current.isRemoved) return false;
  if (authorKey(previous.author) !== authorKey(current.author)) return false;
  if (communityMessageDateKey(previous.createdAt) !== communityMessageDateKey(current.createdAt)) return false;
  const previousTime = Date.parse(previous.createdAt);
  const currentTime = Date.parse(current.createdAt);
  return Number.isFinite(previousTime) && Number.isFinite(currentTime)
    && currentTime >= previousTime
    && currentTime - previousTime <= COMMUNITY_SENDER_GROUP_GAP_MS;
}

export function communityMessageDateLabel(value: string, reference = new Date()) {
  const date = new Date(value);
  const day = new Date(reference);
  date.setHours(0, 0, 0, 0);
  day.setHours(0, 0, 0, 0);
  const dayDelta = Math.round((day.getTime() - date.getTime()) / 86_400_000);
  if (dayDelta === 0) return "Today";
  if (dayDelta === 1) return "Yesterday";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === reference.getFullYear() ? undefined : "numeric",
  });
}
