import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";

const readme = readFileSync("README.md", "utf8");

describe("H.5 documentation entry points", () => {
  it("keeps the small role-based documentation map resolvable", () => {
    const paths = [
      "docs/participants/GETTING_STARTED.md",
      "docs/submissions/PARTICIPANT_WORKSPACE.md",
      "docs/judging/JUDGE_GUIDE.md",
      "docs/JUDGE_AUTHENTICATION.md",
      "docs/admin/ADMIN_GUIDE.md",
      "docs/runbooks/EVENT_DAY_OPERATIONS.md",
      "docs/runbooks/COMMUNITY_OPERATIONS.md",
      "docs/runbooks/PARTICIPANT_EXPERIENCE_OBSERVABILITY.md",
      "docs/runbooks/EVENT_DATABASE_OPERATIONS.md",
      "docs/MCP.md",
      "docs/DEPLOY_RPI.md",
    ];
    for (const path of paths) {
      expect(existsSync(path), path).toBe(true);
      expect(readme).toContain(`(${path})`);
    }
  });

  it("keeps durable participant guidance aligned with current boundaries", () => {
    const guide = readFileSync("docs/participants/GETTING_STARTED.md", "utf8");
    const workspace = readFileSync("docs/submissions/PARTICIPANT_WORKSPACE.md", "utf8");
    expect(guide).toContain("recipient does not need to be online or signed in");
    expect(guide).toContain("Team Chat");
    expect(guide).toContain("authoritative event publication");
    expect(workspace).toContain("discoverable non-self person");
    expect(workspace).toContain("accepted project owner");
  });

  it("keeps the first-start path oriented without changing its submission contract", () => {
    const source = readFileSync("app/start/StartClient.tsx", "utf8");
    expect(source).toContain("review Preview");
    expect(source).toContain("Save it to My Projects");
    expect(source).toContain("No account is required to begin.");
  });
});
