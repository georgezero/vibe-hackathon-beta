import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("H.4R open social access", () => {
  it("keeps People directory membership-independent and makes every non-self card messageable", () => {
    const directory = readFileSync("lib/people-directory.ts", "utf8");
    const people = readFileSync("app/people/page.tsx", "utf8");
    const profileEditor = readFileSync("app/account/profile/ProfileEditorClient.tsx", "utf8");
    expect(directory).toContain("viewerUserId");
    expect(directory).toContain("isSelf");
    expect(directory).not.toContain("directMessageEligibilityForUsers");
    expect(directory).not.toContain("canMessage");
    expect(profileEditor).not.toContain("Who can message you?");
    expect(profileEditor).not.toContain("allowIncoming");
    expect(directory).not.toContain("activeParticipantForEvent(eventId)");
    expect(people).toContain("<MessageProfileButton handle={person.handle} />");
  });

  it("keeps DM initiation account/safety scoped rather than event-membership scoped", () => {
    const source = readFileSync("lib/direct-messaging.ts", "utf8");
    expect(source).not.toContain("export async function directMessageEligibilityForUsers");
    expect(source).not.toContain("preferenceFor(row.userId)");
    expect(source).not.toContain("preferenceMap");
    expect(source).toContain("if (!(await activeAccount(input.senderUserId)))");
    expect(source).toContain("blockedEitherWay");
    expect(source).not.toContain("eventParticipant");
  });

  it("keeps Community event-scoped while using active-account social access", () => {
    const source = readFileSync("lib/community-channels.ts", "utf8");
    expect(source).toContain("export async function canAccessCommunity");
    expect(source).toContain("return activeAccount(userId)");
    expect(source).toContain("eq(communityChannels.eventId, eventId)");
    expect(source).toContain("postingPolicy !== \"admins_only\"");
    expect(source).toContain("from(users).leftJoin(userAccountControls");
  });

  it("preserves project-local authorization boundaries", () => {
    const chat = readFileSync("lib/native-chat.ts", "utf8");
    expect(chat).toContain("submissionMemberships.userId");
    expect(chat).toContain("eq(submissionMemberships.status, \"active\")");
  });
});
