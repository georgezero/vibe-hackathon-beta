/**
 * Resolves the canonical screenshot URL list for a submission.
 *
 * Priority:
 *   1. screenshotUrls[] — new multi-screenshot field, if present and non-empty
 *   2. screenshotUrl   — legacy single field, wrapped in an array
 *   3. []              — no screenshots
 *
 * Existing submissions that only have screenshotUrl continue to work without
 * any migration. New submissions store all URLs in screenshotUrls and mirror
 * the first to screenshotUrl for backward compatibility.
 */
export function resolveScreenshotUrls(sub: {
  screenshotUrl?: string | null;
  screenshotUrls?: unknown;
}): string[] {
  const urls = sub.screenshotUrls as string[] | null | undefined;
  if (Array.isArray(urls) && urls.length > 0) return urls;
  if (sub.screenshotUrl) return [sub.screenshotUrl];
  return [];
}
