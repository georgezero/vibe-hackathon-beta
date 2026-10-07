import type { NextRequest } from "next/server";

export type SameOriginFailure =
  | "missing_origin"
  | "malformed_origin"
  | "origin_mismatch"
  | "cross_site_request";

export function strictSameOriginFailure(
  request: Pick<NextRequest, "headers">,
  canonicalOrigin: string,
): SameOriginFailure | null {
  const origin = request.headers.get("origin");
  if (!origin) return "missing_origin";
  if (origin === "null") return "malformed_origin";

  let parsedOrigin: URL;
  try {
    parsedOrigin = new URL(origin);
  } catch {
    return "malformed_origin";
  }

  if (!["http:", "https:"].includes(parsedOrigin.protocol)) {
    return "malformed_origin";
  }
  if (parsedOrigin.username || parsedOrigin.password) return "malformed_origin";
  if (parsedOrigin.pathname !== "/" || parsedOrigin.search || parsedOrigin.hash) {
    return "malformed_origin";
  }
  if (origin !== parsedOrigin.origin) return "malformed_origin";
  if (origin !== canonicalOrigin) return "origin_mismatch";

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin") return "cross_site_request";

  return null;
}
