export type VideoProvider = "youtube" | "loom" | "vimeo";

export interface VideoInfo {
  provider: VideoProvider;
  embedUrl: string;
}

/**
 * Detects the video provider from a URL and returns an embed URL.
 * Returns null for unsupported providers — callers should fall back to a plain link.
 */
export function detectVideo(url: string): VideoInfo | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const host = parsed.hostname.replace(/^www\./, "");

  // YouTube: youtube.com/watch?v=ID or youtu.be/ID
  if (host === "youtube.com") {
    const v = parsed.searchParams.get("v");
    if (v) return { provider: "youtube", embedUrl: `https://www.youtube.com/embed/${v}` };
  }
  if (host === "youtu.be") {
    const v = parsed.pathname.slice(1).split("?")[0];
    if (v) return { provider: "youtube", embedUrl: `https://www.youtube.com/embed/${v}` };
  }

  // Loom: loom.com/share/ID
  if (host === "loom.com") {
    const match = parsed.pathname.match(/\/share\/([a-zA-Z0-9]+)/);
    if (match) return { provider: "loom", embedUrl: `https://www.loom.com/embed/${match[1]}` };
  }

  // Vimeo: vimeo.com/ID
  if (host === "vimeo.com") {
    const match = parsed.pathname.match(/^\/(\d+)/);
    if (match) return { provider: "vimeo", embedUrl: `https://player.vimeo.com/video/${match[1]}` };
  }

  return null;
}
