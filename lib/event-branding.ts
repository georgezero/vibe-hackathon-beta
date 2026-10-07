import { cache } from "react";
import { getActiveEvent } from "./events";

export interface EventBranding {
  /** Resolved display name. Falls back to "Vibe Hackathon". */
  eventName: string;
  /** Always "Vibe Hackathon" — the platform brand. */
  siteName: string;
  /** Event logo URL, or null if not configured. */
  logoUrl: string | null;
  /** Short event tagline, or null when not configured. */
  tagline: string | null;
  /** Optional external event website URL. */
  externalUrl: string | null;
}

/**
 * Resolves event branding from:
 *   1. active event DB fields (displayName, logoUrl, tagline)
 *   2. environment variables (VIBE_HACKATHON_EVENT_NAME, VIBE_HACKATHON_EVENT_LOGO_URL)
 *   3. fallback defaults.
 *
 * Memoised with React.cache so multiple server components calling this
 * within the same request share a single DB query.
 */
export const getEventBranding = cache(async (): Promise<EventBranding> => {
  const event = await getActiveEvent();

  const eventName =
    event.displayName ||
    process.env.VIBE_HACKATHON_EVENT_NAME ||
    "Vibe Hackathon";

  const logoUrl =
    event.logoUrl ||
    process.env.VIBE_HACKATHON_EVENT_LOGO_URL ||
    null;

  const tagline =
    event.tagline ||
    null;

  return {
    eventName,
    siteName: "Vibe Hackathon",
    logoUrl,
    tagline,
    externalUrl: event.externalUrl || null,
  };
});
