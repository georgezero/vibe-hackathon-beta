import {
  isExplicitDevelopmentRuntime,
  isProductionSafeRuntime,
} from "./runtime-mode";

export function canonicalizeConfiguredBaseUrl(configured: string) {
  let parsed: URL;
  try {
    parsed = new URL(configured.trim());
  } catch {
    throw new Error("VIBE_HACKATHON_BASE_URL is not a valid application origin.");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("VIBE_HACKATHON_BASE_URL is not a valid application origin.");
  }
  if (parsed.username || parsed.password) {
    throw new Error("VIBE_HACKATHON_BASE_URL is not a valid application origin.");
  }
  if (parsed.pathname !== "/" || parsed.search || parsed.hash) {
    throw new Error("VIBE_HACKATHON_BASE_URL is not a valid application origin.");
  }
  if (isProductionSafeRuntime() && parsed.protocol !== "https:") {
    throw new Error("VIBE_HACKATHON_BASE_URL must use HTTPS.");
  }

  return parsed.origin;
}

/**
 * Returns the canonical base URL for this deployment.
 *
 * Priority:
 * 1. VIBE_HACKATHON_BASE_URL — explicitly configured, mandatory in production
 * 2. http://localhost:3000    — development fallback only (NODE_ENV=development)
 *
 * Use this everywhere a URL must be stable across environments:
 *   - Generated prompts, packets, curl commands
 *   - Import URLs embedded in agent prompts
 *   - /api/v1/spec base_url field
 *   - Any email or shareable link
 *
 * Never derive URLs from request Host headers or tunnel URLs — they rotate.
 */
export function getBaseUrl(): string {
  const configured = process.env.VIBE_HACKATHON_BASE_URL;

  if (configured) {
    return canonicalizeConfiguredBaseUrl(configured);
  }

  if (!isExplicitDevelopmentRuntime()) {
    throw new Error(
      "VIBE_HACKATHON_BASE_URL is required outside explicit development."
    );
  }

  return "http://localhost:3000";
}
