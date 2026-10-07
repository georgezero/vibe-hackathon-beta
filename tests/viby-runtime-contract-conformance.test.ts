import Database from "better-sqlite3";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  VIBY_RUNTIME_CALLBACK_PATH,
  VIBY_RUNTIME_MODE,
  VIBY_RUNTIME_SOURCE,
  safeVibyReturnTo,
  vibyLoginPolicy,
} from "../lib/viby-login-policy";

function transactionDatabase(path: string) {
  const db = new Database(path);
  db.exec(`
    PRAGMA foreign_keys=ON;
    CREATE TABLE viby_login_transactions (
      id TEXT PRIMARY KEY,
      state_hash TEXT NOT NULL UNIQUE,
      browser_binding_hash TEXT NOT NULL,
      operation TEXT NOT NULL
        CHECK (operation IN ('admin_login','judge_login')),
      return_to TEXT NOT NULL,
      expected_audience TEXT NOT NULL,
      freshness_required INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      consumed_at INTEGER,
      failure_code TEXT
    );
    CREATE INDEX viby_login_transactions_expires_idx
      ON viby_login_transactions(expires_at);
  `);
  db.close();
}

describe("B.4.4A Runtime contract conformance", () => {
  it("uses the registered callback, mode, and source for admin and judge launch", () => {
    for (const operation of ["admin_login", "judge_login"] as const) {
      expect(vibyLoginPolicy(operation)).toMatchObject({
        callbackPath: VIBY_RUNTIME_CALLBACK_PATH,
        runtimeMode: VIBY_RUNTIME_MODE,
        source: VIBY_RUNTIME_SOURCE,
        allowIdentityLinking: true,
      });
    }
    expect(vibyLoginPolicy("admin_login").auditEvents).toMatchObject({
      denied: "viby_admin_assertion_denied",
      linkStarted: "viby_identity_link_pending_created",
    });
    expect(vibyLoginPolicy("judge_login").auditEvents).toMatchObject({
      denied: "judge_viby_login_denied",
      linkStarted: "judge_viby_link_started",
    });
    expect(VIBY_RUNTIME_CALLBACK_PATH).toBe("/admin/viby/callback");
    expect(VIBY_RUNTIME_MODE).toBe("admin");
    expect(VIBY_RUNTIME_SOURCE).toBe("vibe_admin_confirmation");
    expect(vibyLoginPolicy("application_login")).toMatchObject({
      routineFreshnessRequired: true,
      rememberedLoginAllowed: false,
      callbackPath: VIBY_RUNTIME_CALLBACK_PATH,
      runtimeMode: VIBY_RUNTIME_MODE,
      source: VIBY_RUNTIME_SOURCE,
    });
  });

  it("has exactly one authoritative interactive assertion callback handler", () => {
    const adminCallback = readFileSync("app/admin/viby/callback/route.ts", "utf8");
    const unified = readFileSync("lib/viby-unified-callback.ts", "utf8");
    const start = readFileSync("app/api/viby/start/route.ts", "utf8");
    expect(adminCallback).toContain("handleUnifiedVibyCallback");
    expect(unified).toContain("inspectVibyLoginTransactionState(state)");
    expect(unified).toContain("isVibyLoginOperation(transaction.operation)");
    expect(start).not.toContain("/judge/viby/callback");
    expect(start).not.toContain("vibe_judge_login");
    expect(() => readFileSync("app/judge/viby/callback/route.ts", "utf8"))
      .toThrow();
  });

  it("dispatches only from opaque server state and atomically rejects mismatch and replay", () => {
    const dir = mkdtempSync(join(tmpdir(), "vibe-b44a-dispatch-"));
    const path = join(dir, "app.db");
    transactionDatabase(path);
    const output = execFileSync(
      "npx",
      ["tsx", "tests/helpers/viby-operation-dispatch-smoke.ts"],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          NODE_ENV: "test",
          DB_FILE_NAME: path,
        },
        encoding: "utf8",
      },
    );
    expect(JSON.parse(output.trim())).toEqual({
      adminInspection: { found: true, operation: "admin_login" },
      judgeInspection: { found: true, operation: "judge_login" },
      browserMismatch: false,
      judgeOperation: "judge_login",
      judgeReturnTo: "/judge/dashboard",
      judgeReplay: false,
      adminOperation: "admin_login",
      adminReturnTo: "/admin/dashboard",
    });
  }, 30_000);

  it("keeps operation-specific destinations server allow-listed", () => {
    expect(safeVibyReturnTo("admin_login", "/judge/dashboard"))
      .toBe("/admin/dashboard");
    expect(safeVibyReturnTo("judge_login", "/admin/dashboard"))
      .toBe("/judge/dashboard");
    expect(safeVibyReturnTo("judge_login", "https://attacker.example/judge"))
      .toBe("/judge/dashboard");
  });

  it("never trusts browser operation, source, callback path, or role", () => {
    const callback = readFileSync("lib/viby-unified-callback.ts", "utf8");
    expect(callback).not.toContain('searchParams.get("operation")');
    expect(callback).not.toContain('searchParams.get("source")');
    expect(callback).not.toContain('searchParams.get("role")');
  });

  it("enforces freshness for generic application callbacks, including stale transactions", () => {
    const callback = readFileSync("lib/viby-unified-callback.ts", "utf8");
    expect(callback).toContain("policy.routineFreshnessRequired && !transaction.freshnessRequired");
    expect(callback).toContain("transaction.freshnessRequired || policy.routineFreshnessRequired");
  });
});
