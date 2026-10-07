import { NextResponse } from "next/server";
import { getBaseUrl } from "@/lib/base-url";
import {
  VIBY_LINK_BINDING_COOKIE,
  VIBY_LINK_TOKEN_COOKIE,
} from "@/lib/viby-interactive-linking";

export async function GET() {
  const origin = new URL(getBaseUrl()).origin;
  const response = NextResponse.redirect(
    new URL("/judge/link-viby?reason=invalid_transaction", origin),
    303,
  );
  response.cookies.delete(VIBY_LINK_TOKEN_COOKIE);
  response.cookies.delete(VIBY_LINK_BINDING_COOKIE);
  return response;
}
