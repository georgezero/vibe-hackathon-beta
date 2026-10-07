import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("H.4 participant discovery and communication continuity", () => {
  it("keeps the profile-to-message handoff server-authorized and self-safe", () => {
    const profile = readFileSync("app/people/[handle]/page.tsx", "utf8");
    const button = readFileSync("components/MessageProfileButton.tsx", "utf8");
    expect(profile).not.toContain("canInitiateDirectMessage");
    expect(profile).toContain("!isOwner");
    expect(profile).toContain("<MessageProfileButton handle={profile.handle} />");
    expect(button).toContain("/api/direct-messages/conversations");
    expect(button).toContain("router.push(`/messages/${encodeURIComponent(payload.conversationId)}`)");
  });

  it("projects Community only when the authoritative eligibility check passes", () => {
    const navigation = readFileSync("components/NavPublic.tsx", "utf8");
    const nav = readFileSync("components/Nav.tsx", "utf8");
    const community = readFileSync("lib/community-channels.ts", "utf8");
    expect(community).toContain("export async function canAccessCommunity");
    expect(navigation).toContain("canAccessCommunity");
    expect(navigation).toContain("if (communityAvailable) communityUnreadCount");
    expect(nav).toContain("authenticatedAccount && communityAvailable");
    expect(nav).toContain("communityAvailable = false");
  });

  it("keeps Community denial generic for direct unauthorized requests", () => {
    const route = readFileSync("app/community/page.tsx", "utf8");
    const channelRoute = readFileSync("app/community/[channelSlug]/page.tsx", "utf8");
    const mapper = readFileSync("lib/community-route.ts", "utf8");
    expect(route).toContain("isCommunityRouteNotFound");
    expect(channelRoute).toContain("isCommunityRouteNotFound");
    expect(mapper).toContain('error.code === "participant_required"');
    expect(mapper).toContain('error.code === "channel_forbidden"');
  });
});
