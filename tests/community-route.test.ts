import { describe, expect, it } from "vitest";
import { CommunityChannelError } from "@/lib/community-channels";
import { isCommunityRouteNotFound } from "@/lib/community-route";

describe("community page access boundary", () => {
  it.each(["channel_not_found", "participant_required", "channel_forbidden"] as const)(
    "maps %s to the generic not-found page",
    (code) => expect(isCommunityRouteNotFound(new CommunityChannelError(code))).toBe(true),
  );

  it("does not hide unrelated failures behind a not-found response", () => {
    expect(isCommunityRouteNotFound(new Error("database unavailable"))).toBe(false);
  });
});
