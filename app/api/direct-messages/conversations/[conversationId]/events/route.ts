import { NextRequest } from "next/server";
import { resolveApplicationPrincipal } from "@/lib/application-principal";
import { getDirectMessageEvents, resolveDirectConversationAccess } from "@/lib/direct-messaging";
import { allowNativeChatAction } from "@/lib/native-chat-rate-limit";

export const dynamic = "force-dynamic";

function frame(event: string, data: unknown, id?: string) { return `${id ? `id: ${id}\n` : ""}event: ${event}\ndata: ${JSON.stringify(data)}\n\n`; }

export async function GET(request: NextRequest, { params }: { params: Promise<{ conversationId: string }> }) {
  const principal = await resolveApplicationPrincipal(request.headers);
  if (principal.status !== "authenticated") return new Response("Authentication required", { status: 401 });
  const { conversationId } = await params;
  if (!allowNativeChatAction(`dm-sse:${principal.principal.user.id}`, 4, 60_000)) return new Response("Too many realtime connections", { status: 429 });
  try { await resolveDirectConversationAccess({ conversationId, userId: principal.principal.user.id }); } catch { return new Response("Conversation unavailable", { status: 403 }); }
  const supplied = request.nextUrl.searchParams.get("after") ?? "";
  let cursor = supplied.trim();
  const encoder = new TextEncoder(); let closed = false;
  let interval: ReturnType<typeof setInterval> | undefined; let timeout: ReturnType<typeof setTimeout> | undefined;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const write = (value: string) => { if (!closed) controller.enqueue(encoder.encode(value)); };
      write(frame("ready", { conversationId }));
      const poll = async () => {
        if (closed || request.signal.aborted) return;
        try {
          const access = await resolveDirectConversationAccess({ conversationId, userId: principal.principal.user.id });
          if (!access.canSend) {
            write(frame("revoked", { reason: access.blocked ? "messaging_blocked" : "messaging_unavailable" })); closed = true;
            if (interval) clearInterval(interval); if (timeout) clearTimeout(timeout); controller.close(); return;
          }
          const rows = await getDirectMessageEvents({ conversationId, userId: principal.principal.user.id, after: cursor || undefined });
          for (const row of rows) { cursor = row.cursor; write(frame("message", row.message, row.cursor)); }
        } catch {
          if (interval) clearInterval(interval); if (timeout) clearTimeout(timeout);
          write(frame("error", { message: "Messaging is temporarily unavailable." })); closed = true; controller.close();
        }
      };
      interval = setInterval(() => { void poll(); }, 1000);
      timeout = setTimeout(() => { if (closed) return; if (interval) clearInterval(interval); write(": close\n\n"); closed = true; controller.close(); }, 25_000);
      request.signal.addEventListener("abort", () => { if (closed) return; closed = true; if (interval) clearInterval(interval); if (timeout) clearTimeout(timeout); controller.close(); }, { once: true });
    },
    cancel() { closed = true; if (interval) clearInterval(interval); if (timeout) clearTimeout(timeout); },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" } });
}
