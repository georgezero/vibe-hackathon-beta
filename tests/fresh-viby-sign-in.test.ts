import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const order: string[] = [];
const { getSession, signOut } = vi.hoisted(() => ({
  getSession: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession, signOut } } }));

import { beginFreshVibySignIn } from "@/lib/fresh-viby-sign-in";

describe("fresh Viby application-session replacement", () => {
  beforeEach(() => {
    order.length = 0;
    getSession.mockReset();
    signOut.mockReset();
    getSession
      .mockImplementationOnce(async () => {
        order.push("resolve-current");
        return { session: { id: "old-session" }, user: { id: "old-user" } };
      })
      .mockImplementationOnce(async () => {
        order.push("verify-anonymous");
        return null;
      });
    signOut.mockImplementation(async () => {
      order.push("invalidate");
      return new Response(null, {
        headers: {
          "set-cookie": "__Secure-better-auth.session_token=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax",
        },
      });
    });
  });

  it("invalidates and verifies anonymity before creating the new transaction", async () => {
    const request = new NextRequest("https://app.example/api/viby/start", {
      method: "POST",
      headers: {
        cookie: [
          "__Secure-better-auth.session_token=old",
          "vibe_judge_session=legacy",
          "vibe_viby_session_handoff=stale",
          "vibe_account_invitation=stale-invitation",
          "preference=preserved",
        ].join("; "),
      },
    });
    const response = await beginFreshVibySignIn(request, {
      operation: "judge_login",
      createLaunchResponse: async () => {
        order.push("create-transaction");
        const launch = NextResponse.redirect("https://viby.example/start", 303);
        launch.cookies.set("vibe_viby_login_binding", "new-binding", {
          httpOnly: true,
          sameSite: "lax",
          secure: true,
          path: "/",
        });
        return launch;
      },
    });

    expect(order).toEqual([
      "resolve-current",
      "invalidate",
      "verify-anonymous",
      "create-transaction",
    ]);
    const cookies = response.headers.getSetCookie();
    for (const name of [
      "__Secure-better-auth.session_token",
      "vibe_judge_session",
      "vibe_viby_session_handoff",
      "vibe_account_invitation",
    ]) {
      expect(cookies.some((cookie) =>
        cookie.startsWith(`${name}=`) && cookie.includes("Max-Age=0")
      )).toBe(true);
    }
    expect(cookies.filter((cookie) =>
      cookie.startsWith("vibe_viby_login_binding=")
    )).toHaveLength(1);
    expect(cookies.some((cookie) => cookie.startsWith("preference="))).toBe(false);
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("fails closed before transaction creation when anonymity cannot be established", async () => {
    getSession.mockReset();
    getSession.mockResolvedValue({ session: { id: "still-active" } });
    const createLaunchResponse = vi.fn();
    await expect(beginFreshVibySignIn(
      new NextRequest("https://app.example/api/viby/start", { method: "POST" }),
      { operation: "admin_login", createLaunchResponse },
    )).rejects.toThrow("failed closed");
    expect(createLaunchResponse).not.toHaveBeenCalled();
  });
});
