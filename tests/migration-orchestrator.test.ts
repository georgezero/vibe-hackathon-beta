import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CANONICAL_MIGRATIONS } from "../scripts/migrations/index";

describe("canonical database migration manifest", () => {
  it("has unique, ordered entries whose scripts exist", () => {
    const ids = CANONICAL_MIGRATIONS.map((migration) => migration.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(CANONICAL_MIGRATIONS.length).toBeGreaterThanOrEqual(18);
    for (const migration of CANONICAL_MIGRATIONS) {
      expect(fs.existsSync(path.resolve(process.cwd(), migration.script))).toBe(true);
      expect(migration.confirmation("/tmp/application.sqlite")).toMatch(/DATABASE|CREATE_VIBY/);
    }
    expect(CANONICAL_MIGRATIONS.at(-1)?.id).toBe("H2-participant-experience");
  });

  it("uses the canonical orchestrator and the actual Viby script name", () => {
    const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8")) as {
      scripts?: Record<string, string>;
    };
    expect(packageJson.scripts?.["db:migrate"]).toBe("tsx scripts/migrate-all.ts");
    expect(packageJson.scripts?.["db:migrate:viby-identity-links"]).toBe(
      "tsx scripts/migrate-viby-identity-links.ts",
    );
    expect(packageJson.scripts?.["db:migrate:viby-links"]).toBeUndefined();
    expect(fs.existsSync("scripts/migrate-all.ts")).toBe(true);
  });
});
