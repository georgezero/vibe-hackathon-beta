import fs from "fs";
import path from "path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import {
  ADMIN_API_POLICIES,
  type AdminApiPolicy,
} from "@/lib/admin-api-policy";

const HTTP_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);
const ADMIN_ROUTES_ROOT = path.join(process.cwd(), "app", "api", "admin");

const EXPECTED_HANDLERS = [
  "GET /api/admin/ai-runs",
  "POST /api/admin/ai-runs",
  "GET /api/admin/ai-runs/[id]",
  "POST /api/admin/ai-runs/batch",
  "POST /api/admin/ai-runs/import",
  "GET /api/admin/ai-runs/packet/[submissionId]",
  "GET /api/admin/ai-runs/prompt/[submissionId]",
  "POST /api/admin/ai-runs/token/[submissionId]",
  "GET /api/admin/community/channels",
  "GET /api/admin/community/reports",
  "GET /api/admin/event-health",
  "GET /api/admin/participant-experience",
  "GET /api/admin/events",
  "POST /api/admin/events",
  "PATCH /api/admin/events",
  "POST /api/admin/judging",
  "POST /api/admin/calibration",
  "POST /api/admin/publication",
  "GET /api/admin/publication/export",
  "GET /api/admin/export/[dataset]",
  "GET /api/admin/results/export",
  "PATCH /api/admin/community/channels",
  "PATCH /api/admin/invitations/[invitationId]",
  "POST /api/admin/people",
  "PATCH /api/admin/people/[userId]",
  "POST /api/admin/people/[userId]",
  "POST /api/admin/results",
  "POST /api/admin/community/channels",
  "POST /api/admin/community/messages/[messageId]",
  "POST /api/admin/seed",
  "PATCH /api/admin/participant-experience/feedback/[feedbackId]",
].sort();

interface DiscoveredHandler {
  handlerKey: string;
  policyKey: string | null;
  usesWrapper: boolean;
}

function routeFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return routeFiles(entryPath);
    return entry.isFile() && entry.name === "route.ts" ? [entryPath] : [];
  });
}

function routePath(file: string) {
  const relativeDirectory = path.relative(ADMIN_ROUTES_ROOT, path.dirname(file));
  const suffix = relativeDirectory
    ? `/${relativeDirectory.split(path.sep).join("/")}`
    : "";
  return `/api/admin${suffix}`;
}

function exportedHandlers(file: string): DiscoveredHandler[] {
  const source = fs.readFileSync(file, "utf8");
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const route = routePath(file);
  const discovered: DiscoveredHandler[] = [];

  for (const statement of sourceFile.statements) {
    const modifiers = ts.canHaveModifiers(statement)
      ? ts.getModifiers(statement)
      : undefined;
    const exported = modifiers?.some(
      (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
    );
    if (!exported) continue;

    if (ts.isFunctionDeclaration(statement) && statement.name) {
      const method = statement.name.text;
      if (HTTP_METHODS.has(method)) {
        discovered.push({
          handlerKey: `${method} ${route}`,
          policyKey: null,
          usesWrapper: false,
        });
      }
      continue;
    }

    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name)) continue;
      const method = declaration.name.text;
      if (!HTTP_METHODS.has(method)) continue;

      const initializer = declaration.initializer;
      const wrapperCall = (
        initializer
        && ts.isCallExpression(initializer)
        && ts.isIdentifier(initializer.expression)
        && initializer.expression.text === "withAdminApi"
      ) ? initializer : null;
      const usesWrapper = Boolean(wrapperCall);
      const firstArgument = wrapperCall
        ? wrapperCall.arguments[0]
        : undefined;
      const policyKey = firstArgument && ts.isStringLiteral(firstArgument)
        ? firstArgument.text
        : null;

      discovered.push({
        handlerKey: `${method} ${route}`,
        policyKey,
        usesWrapper,
      });
    }
  }

  return discovered;
}

describe("admin API route policy inventory", () => {
  const handlers = routeFiles(ADMIN_ROUTES_ROOT).flatMap(exportedHandlers);
  const discoveredKeys = handlers.map((handler) => handler.handlerKey).sort();
  const policyKeys = Object.keys(ADMIN_API_POLICIES).sort();

  it("matches the reviewed handler inventory", () => {
    expect(discoveredKeys).toEqual(EXPECTED_HANDLERS);
  });

  it("has exactly one non-stale policy for every handler", () => {
    expect(policyKeys).toEqual(discoveredKeys);
  });

  it("exports every handler through withAdminApi using its own policy key", () => {
    for (const handler of handlers) {
      expect(handler.usesWrapper, handler.handlerKey).toBe(true);
      expect(handler.policyKey, handler.handlerKey).toBe(handler.handlerKey);
    }
  });

  it("requires justification for exceptional access policies", () => {
    for (const [key, policy] of Object.entries(ADMIN_API_POLICIES) as Array<
      [string, AdminApiPolicy]
    >) {
      if (policy.access === "development-only" || policy.access === "intentionally-public") {
        expect(policy.justification?.trim(), key).toBeTruthy();
      }
    }
  });

  it("keeps seed as the only development-only route and has no public exceptions", () => {
    const policies = Object.entries(ADMIN_API_POLICIES) as Array<
      [string, AdminApiPolicy]
    >;
    const developmentOnly = policies
      .filter(([, policy]) => policy.access === "development-only")
      .map(([key]) => key);
    const intentionallyPublic = policies
      .filter(([, policy]) => policy.access === "intentionally-public")
      .map(([key]) => key);

    expect(developmentOnly).toEqual(["POST /api/admin/seed"]);
    expect(intentionallyPublic).toEqual([]);
  });
});
