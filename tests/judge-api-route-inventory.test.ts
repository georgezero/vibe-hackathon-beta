import fs from "fs";
import path from "path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import {
  JUDGE_API_POLICIES,
} from "@/lib/judge-api-policy";

const HTTP_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);
const EXPECTED_HANDLERS = [
  "GET /api/judge/data",
  "POST /api/scores",
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
  const appRoot = path.join(process.cwd(), "app");
  const relative = path.relative(appRoot, path.dirname(file));
  return `/${relative.split(path.sep).join("/")}`;
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
    if (!modifiers?.some((item) => item.kind === ts.SyntaxKind.ExportKeyword)) {
      continue;
    }

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
      const wrapperCall = initializer
        && ts.isCallExpression(initializer)
        && ts.isIdentifier(initializer.expression)
        && initializer.expression.text === "withJudgeApi"
        ? initializer
        : null;
      const firstArgument = wrapperCall?.arguments[0];
      discovered.push({
        handlerKey: `${method} ${route}`,
        policyKey: firstArgument && ts.isStringLiteral(firstArgument)
          ? firstArgument.text
          : null,
        usesWrapper: Boolean(wrapperCall),
      });
    }
  }
  return discovered;
}

describe("judge API route policy inventory", () => {
  const judgeRoot = path.join(process.cwd(), "app", "api", "judge");
  const files = [
    ...routeFiles(judgeRoot),
    path.join(process.cwd(), "app", "api", "scores", "route.ts"),
  ];
  const handlers = files.flatMap(exportedHandlers);
  const discoveredKeys = handlers.map((item) => item.handlerKey).sort();

  it("matches the reviewed route inventory", () => {
    expect(discoveredKeys).toEqual(EXPECTED_HANDLERS);
  });

  it("has exactly one non-stale explicit policy per handler", () => {
    expect(Object.keys(JUDGE_API_POLICIES).sort()).toEqual(discoveredKeys);
  });

  it("exports every route through withJudgeApi using its own policy key", () => {
    for (const handler of handlers) {
      expect(handler.usesWrapper, handler.handlerKey).toBe(true);
      expect(handler.policyKey, handler.handlerKey).toBe(handler.handlerKey);
    }
  });

  it("has no public credential exchange or development routes", () => {
    for (const key of Object.keys(JUDGE_API_POLICIES)) {
      expect(key).not.toContain("development");
    }
    expect(Object.keys(JUDGE_API_POLICIES)).not.toContain("POST /api/judge/session");
    expect(Object.keys(JUDGE_API_POLICIES)).not.toContain("POST /api/judge/logout");
  });
});
