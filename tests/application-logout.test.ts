import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const { getSession, signOut } = vi.hoisted(() => ({
  getSession: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  auth: {
    api: { getSession, signOut },
  },
}));

import { applyApplicationLogout } from "@/lib/application-logout";

describe("application logout", () => {
  beforeEach(() => {
    signOut.mockReset();
    getSession.mockReset();
    getSession.mockResolvedValue(null);
    signOut.mockResolvedValue(new Response(
      JSON.stringify({ success: true }),
      {
        headers: {
          "set-cookie":
            "__Secure-better-auth.session_token=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax",
        },
      },
    ));
  });

  it("invalidates Better Auth and expires only application-owned cookies", async () => {
    const request = new NextRequest("https://vibe.example.test/admin/logout", {
      method: "POST",
      headers: {
        cookie: [
          "__Secure-better-auth.session_token=signed",
          "better-auth.session_token=stale-development",
          "__Secure-better-auth.session_data.0=chunk",
          "vibe_admin_session=legacy",
          "vibe_judge_session=legacy-judge",
          "vibe_viby_login_binding=binding",
          "unrelated_preference=keep",
        ].join("; "),
      },
    });
    const response = NextResponse.redirect(
      "https://vibe.example.test/admin?reason=logged_out",
      303,
    );
    await applyApplicationLogout(request, response);

    expect(signOut).toHaveBeenCalledOnce();
    expect(getSession).toHaveBeenCalledTimes(2);
    expect(signOut).toHaveBeenCalledWith({
      headers: request.headers,
      asResponse: true,
    });
    const setCookies = response.headers.getSetCookie();
    for (const name of [
      "__Secure-better-auth.session_token",
      "better-auth.session_token",
      "__Secure-better-auth.session_data.0",
      "vibe_admin_session",
      "vibe_judge_session",
      "vibe_viby_login_binding",
    ]) {
      expect(setCookies.some((cookie) =>
        cookie.startsWith(`${name}=`) && cookie.includes("Max-Age=0")
      )).toBe(true);
    }
    expect(setCookies.some((cookie) =>
      cookie.startsWith("unrelated_preference=")
    )).toBe(false);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("pragma")).toBe("no-cache");
  });

  it("is idempotent without an incoming session cookie", async () => {
    const request = new NextRequest("https://vibe.example.test/judge/logout", {
      method: "POST",
    });
    const response = NextResponse.json({ success: true });
    await expect(
      applyApplicationLogout(request, response),
    ).resolves.toBe(response);
    expect(signOut).toHaveBeenCalledOnce();
    expect(response.headers.getSetCookie().some((cookie) =>
      cookie.startsWith("__Secure-better-auth.session_token=")
      && cookie.includes("Max-Age=0")
    )).toBe(true);
  });

  it("can preserve only a newly issued browser binding during account switching", async () => {
    const request = new NextRequest(
      "https://vibe.example.test/judge/switch-account",
      {
        method: "POST",
        headers: { cookie: "vibe_viby_login_binding=old-binding" },
      },
    );
    const response = NextResponse.redirect(
      "https://viby.example.test/apps/vibe-hackathon/start",
      303,
    );
    response.cookies.set("vibe_viby_login_binding", "new-binding", {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
    });
    await applyApplicationLogout(request, response, {
      preserve: ["vibe_viby_login_binding"],
    });
    const bindingCookies = response.headers.getSetCookie().filter((cookie) =>
      cookie.startsWith("vibe_viby_login_binding=")
    );
    expect(bindingCookies).toHaveLength(1);
    expect(bindingCookies[0]).not.toContain("Max-Age=0");
  });
});
