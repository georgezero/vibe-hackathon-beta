import { NextRequest } from "next/server";
import { resolveApplicationPrincipal } from "@/lib/application-principal";
import { CommunityChannelError, getCommunityEvents, resolveCommunityChannelAccess } from "@/lib/community-channels";
import { getActiveEvent } from "@/lib/events";
import { allowNativeChatAction } from "@/lib/native-chat-rate-limit";

export const dynamic = "force-dynamic";

function frame(event: string, data: unknown, id?: string) { return `${id ? `id: ${id}\n` : ""}event: ${event}\ndata: ${JSON.stringify(data)}\n\n`; }

export async function GET(request: NextRequest, { params }: { params: Promise<{ channelSlug: string }> }) {
  const principal = await resolveApplicationPrincipal(request.headers);
  if (principal.status !== "authenticated") return new Response("Authentication required", { status: 401 });
  const { channelSlug } = await params;
  if (!allowNativeChatAction(`community-sse:${principal.principal.user.id}`, 4, 60_000)) return new Response("Too many realtime connections", { status: 429 });
  try { const event = await getActiveEvent(); await resolveCommunityChannelAccess({ slug: channelSlug, userId: principal.principal.user.id, eventId: event.id }); } catch { return new Response("Community channel unavailable", { status: 403 }); }
  let cursor = request.nextUrl.searchParams.get("after")?.trim() ?? "";
  const encoder = new TextEncoder(); let closed = false; let interval: ReturnType<typeof setInterval> | undefined; let timeout: ReturnType<typeof setTimeout> | undefined;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const write = (value: string) => { if (!closed) controller.enqueue(encoder.encode(value)); };
      write(frame("ready", { channelSlug }));
      const poll = async () => {
        if (closed || request.signal.aborted) return;
        try {
          const event = await getActiveEvent();
          const access = await resolveCommunityChannelAccess({ slug: channelSlug, userId: principal.principal.user.id, eventId: event.id });
          if (access.channel.status === "archived") { write(frame("archived", { channelSlug })); closed = true; if (interval) clearInterval(interval); if (timeout) clearTimeout(timeout); controller.close(); return; }
          const rows = await getCommunityEvents({ slug: channelSlug, userId: principal.principal.user.id, eventId: event.id, after: cursor || undefined });
          for (const row of rows) { cursor = row.cursor; write(frame("message", row.message, row.cursor)); }
        } catch (error) { if (interval) clearInterval(interval); if (timeout) clearTimeout(timeout); write(frame("error", { message: error instanceof CommunityChannelError ? "Community is temporarily unavailable." : "Community is temporarily unavailable." })); closed = true; controller.close(); }
      };
      interval = setInterval(() => { void poll(); }, 1000);
      timeout = setTimeout(() => { if (closed) return; if (interval) clearInterval(interval); write(": close\n\n"); closed = true; controller.close(); }, 25_000);
      request.signal.addEventListener("abort", () => { if (closed) return; closed = true; if (interval) clearInterval(interval); if (timeout) clearTimeout(timeout); controller.close(); }, { once: true });
    },
    cancel() { closed = true; if (interval) clearInterval(interval); if (timeout) clearTimeout(timeout); },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" } });
}
