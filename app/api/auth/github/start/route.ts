import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const next = req.nextUrl.searchParams.get("next") ?? "/register-team";
  return NextResponse.redirect(new URL(next, req.nextUrl.origin));
}
