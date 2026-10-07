import { describe, expect, it } from "vitest";
import { COMMUNITY_SENDER_GROUP_GAP_MS, communityMessageDateLabel, isCommunityMessageContinuation } from "@/lib/community-presentation";

const author = { displayName: "Maya Rivera", handle: "maya" };

describe("community conversation presentation", () => {
  it("groups rapid consecutive messages from one sender", () => {
    expect(isCommunityMessageContinuation(
      { createdAt: "2026-08-09T12:00:00.000Z", isRemoved: false, author },
      { createdAt: new Date(Date.parse("2026-08-09T12:00:00.000Z") + COMMUNITY_SENDER_GROUP_GAP_MS).toISOString(), isRemoved: false, author },
    )).toBe(true);
  });

  it("starts a new group when the sender, day, or time gap changes", () => {
    const base = { createdAt: "2026-08-09T12:00:00.000Z", isRemoved: false, author };
    expect(isCommunityMessageContinuation(base, { ...base, createdAt: "2026-08-09T12:06:00.000Z" })).toBe(false);
    expect(isCommunityMessageContinuation(base, { ...base, createdAt: "2026-08-10T12:01:00.000Z" })).toBe(false);
    expect(isCommunityMessageContinuation(base, { ...base, author: { displayName: "Alex Chen", handle: "alex" }, createdAt: "2026-08-09T12:01:00.000Z" })).toBe(false);
    expect(isCommunityMessageContinuation(base, { ...base, isRemoved: true, createdAt: "2026-08-09T12:01:00.000Z" })).toBe(false);
  });

  it("labels nearby dates for orientation", () => {
    const reference = new Date("2026-08-09T15:00:00.000Z");
    expect(communityMessageDateLabel("2026-08-09T12:00:00.000Z", reference)).toBe("Today");
    expect(communityMessageDateLabel("2026-08-08T12:00:00.000Z", reference)).toBe("Yesterday");
    expect(communityMessageDateLabel("2026-08-01T12:00:00.000Z", reference)).toContain("Aug 1");
  });
});
