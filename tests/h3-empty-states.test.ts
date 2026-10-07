import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { deriveEventStage } from "@/lib/event-status";
import { ParticipantEmptyState } from "@/components/ParticipantEmptyState";

describe("H.3 empty-state language", () => {
  it("keeps the shared primitive scoped to empty data, not authorization or lock states", () => {
    const source = readFileSync("components/ParticipantEmptyState.tsx", "utf8");
    expect(source).toContain("participant-empty-state");
    expect(source).not.toContain("Access denied");
    expect(source).not.toContain("deadline");
    expect(ParticipantEmptyState).toBeTypeOf("function");
  });

  it("uses one clear next action for first-use participant surfaces", () => {
    const myProjects = readFileSync("app/account/projects/page.tsx", "utf8");
    const people = readFileSync("app/people/page.tsx", "utf8");
    const messages = readFileSync("app/messages/MessagesList.tsx", "utf8");
    const community = readFileSync("app/community/CommunityClient.tsx", "utf8");
    expect(myProjects).toContain('title="No projects yet"');
    expect(myProjects).toContain('label: "Start a project"');
    expect(people).toContain('title="Participant profiles will appear here"');
    expect(messages).toContain('title="No conversations yet"');
    expect(community).toContain('title={emptyChannelTitle(channel)}');
  });

  it("does not present the legacy winners timestamp as published status when a release is supplied", () => {
    const event = { isFrozen: false, winnersPublishedAt: new Date("2026-01-01T00:00:00Z"), audienceVotingEnabled: false, audienceVotingStartsAt: null, audienceVotingEndsAt: null, audienceResultsVisible: false, audienceVotingMode: "disabled", submissionDeadline: null, judgingDeadline: null } as never;
    expect(deriveEventStage(event, "calculated").label).toBe("Submissions Open");
    expect(deriveEventStage(event, "published").label).toBe("Results Published");
  });

  it("uses the authoritative publication timestamp for published activity", () => {
    const source = readFileSync("lib/event-status.ts", "utf8");
    expect(source).toContain("publishedAt: publicationReleases.publishedAt");
    expect(source).toContain("publication?.publishedAt ?? event.winnersPublishedAt ?? now");
  });

  it("keeps direct unpublished results useful without exposing ranking content", () => {
    const source = readFileSync("app/winners/page.tsx", "utf8");
    expect(source).toContain("publication.release.status");
    expect(source).toContain("Results aren’t published yet.");
    expect(source).toContain("ParticipantEmptyState");
  });

  it("orients the landing page from authoritative event state and real counts", () => {
    const source = readFileSync("app/page.tsx", "utf8");
    expect(source).toContain("getPublicationData(activeEvent.id)");
    expect(source).toContain("submissionDeadlineStatus(activeEvent)");
    expect(source).toContain("projectCount");
    expect(source).not.toContain("EVENT_INFO");
  });

  it("keeps unavailable and empty community states distinct", () => {
    const source = readFileSync("app/community/CommunityClient.tsx", "utf8");
    expect(source).toContain("No announcements yet");
    expect(source).toContain("Find your collaborators");
    expect(source).toContain("Start the conversation");
    expect(source).not.toContain("No data.");
  });

  it("keeps the disposable lifecycle fixture bounded to named synthetic stages", () => {
    const source = readFileSync("scripts/seed-h3-activation-fixtures.ts", "utf8");
    expect(source).toContain('["empty", "sparse", "active", "closed", "published"]');
    expect(source).toContain("syntheticOnly: true");
    expect(source).toContain("must be beneath ${root}/data.");
    expect(source).toContain("The canonical database is not a qualification target.");
  });
});
