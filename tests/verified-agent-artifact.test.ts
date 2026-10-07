import { describe, expect, it } from "vitest";
import {
  VERIFIED_ARTIFACT_TYPES,
  createVerifiedArtifact,
  decodeVerifiedArtifact,
  encodeVerifiedArtifact,
  formatVerifiedArtifactMark,
  normalizeArtifactType,
  sha256,
  truncateHash,
} from "../lib/verifiedArtifacts";
import type { VibyAgentAssertion } from "../lib/viby";

const assertion: VibyAgentAssertion = {
  assertionId: "ast_13f77b1c99999999",
  audience: "vibe-hackathon",
  agentId: "agent_1",
  agentName: "Demo Agent G1",
  agentDisplayName: "Demo Agent G1",
  ownerVibyUserId: "owner_1",
  ownerDisplayName: "George One",
  delegationMethod: "owner_registered",
  method: "agent_delegation",
  issuedAt: "2026-06-09T00:10:00.000Z",
  expiresAt: "2026-06-09T00:15:00.000Z",
  context: { mode: "agent-attribution" },
};

function artifact(overrides: Partial<Parameters<typeof createVerifiedArtifact>[0]> = {}) {
  return createVerifiedArtifact({
    assertion,
    projectId: "sub_1",
    projectTitle: "Pi Finder",
    teamName: "Team Circle",
    problemStatement: "Finds useful approximations of pi for demos.",
    targetUsers: "students",
    createdAt: new Date("2026-06-09T00:15:00.000Z"),
    ...overrides,
  });
}

describe("verified artifact framework", () => {
  it("creates a generic verified artifact with a stable sha256 hash", () => {
    const created = artifact();

    expect(created.artifactId).toBeTruthy();
    expect(created.artifactType).toBe("project-summary");
    expect(created.title).toBe("Project Summary");
    expect(created.generatedByAgentId).toBe("agent_1");
    expect(created.generatedByAgentName).toBe("Demo Agent G1");
    expect(created.ownerDisplayName).toBe("George One");
    expect(created.assertionId).toBe("ast_13f77b1c99999999");
    expect(created.sha256).toBe(sha256(created.content));
    expect(created.signature.actorType).toBe("agent");
    expect(created.signature.issuedAt).toBe("2026-06-09T00:10:00.000Z");
    expect(created.signature.expiresAt).toBe("2026-06-09T00:15:00.000Z");
  });

  it("supports all current artifact types without changing the pipeline", () => {
    for (const config of VERIFIED_ARTIFACT_TYPES) {
      const created = artifact({ artifactType: config.type });

      expect(created.artifactType).toBe(config.type);
      expect(created.title).toBe(config.label);
      expect(created.actionName).toBe(config.actionName);
      expect(created.sha256).toBe(sha256(created.content));
      expect(formatVerifiedArtifactMark(created)).toContain(config.actionName);
    }
  });

  it("normalizes legacy underscore artifact type values", () => {
    expect(normalizeArtifactType("project_summary")).toBe("project-summary");
    expect(normalizeArtifactType("elevator_pitch")).toBe("elevator-pitch");
    expect(normalizeArtifactType("presentation_summary")).toBe("presentation-summary");
    expect(normalizeArtifactType("unknown")).toBe("project-summary");
  });

  it("round-trips signed artifact payloads", () => {
    const created = artifact({ artifactType: "elevator-pitch" });
    const encoded = encodeVerifiedArtifact(created, "test-secret");

    expect(decodeVerifiedArtifact(encoded, "test-secret")).toEqual(created);
  });

  it("rejects tampered signed artifact payloads", () => {
    const created = artifact();
    const encoded = encodeVerifiedArtifact(created, "test-secret");
    const [payload, signature] = encoded.split(".");
    const tampered = `${payload?.replace(/.$/, payload.endsWith("A") ? "B" : "A")}.${signature}`;

    expect(decodeVerifiedArtifact(tampered, "test-secret")).toBeNull();
  });

  it("formats the standard fixed-width Viby verification mark without raw assertion data", () => {
    const created = artifact();
    const mark = formatVerifiedArtifactMark(created);
    const lines = mark.split("\n");

    expect(lines).toHaveLength(6);
    expect(lines[0]?.startsWith("+")).toBe(true);
    expect(lines[5]?.startsWith("+")).toBe(true);
    expect(mark).toContain("| -v- Demo Agent G1 (George One)");
    expect(mark).toContain("| |i| Project Summary Generation");
    expect(mark).toContain("| |b| Verified Identity - confirmed by Viby");
    expect(mark).toContain(`| -y- sha256:${truncateHash(created.sha256)}`);
    expect(new Set(lines.map((line) => line.length)).size).toBe(1);
    expect(/^[\x00-\x7F]*$/.test(mark)).toBe(true);
    expect(mark).not.toContain(created.sha256);
    expect(mark).not.toContain(created.assertionId);
  });
});
