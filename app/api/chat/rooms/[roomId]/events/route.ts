import { and, asc, eq, gt } from "drizzle-orm";
import { NextRequest } from "next/server";
import { resolveApplicationPrincipal } from "@/lib/application-principal";
import { db } from "@/lib/db";
import { chatEvents, chatMessages, users } from "@/lib/db/schema";
import { isNativeChatRoomEnabled, resolveChatRoomAccess } from "@/lib/native-chat";
import { allowNativeChatAction } from "@/lib/native-chat-rate-limit";

export const dynamic = "force-dynamic";

function frame(event: string, data: unknown, id?: string) {
  return `${id ? `id: ${id}\n` : ""}event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  const principal = await resolveApplicationPrincipal(request.headers);
  if (principal.status !== "authenticated") return new Response("Authentication required", { status: 401 });
  const { roomId } = await params;
  if (!await isNativeChatRoomEnabled(roomId)) return new Response("Messaging is temporarily unavailable.", { status: 503 });
  if (!allowNativeChatAction(`sse:${principal.principal.user.id}`, 4, 60_000)) return new Response("Too many realtime connections", { status: 429 });
  const initial = await resolveChatRoomAccess({ roomId, userId: principal.principal.user.id });
  if (initial.status !== "active") return new Response("Team membership required", { status: 403 });
  const suppliedCursor = Number(request.nextUrl.searchParams.get("after") ?? "");
  // Chat timestamps are SQLite-second precision; a zero cursor is deliberate
  // for the initial stream so same-second events cannot be skipped.
  let cursor = Number.isFinite(suppliedCursor) && suppliedCursor >= 0 ? suppliedCursor : 0;
  const encoder = new TextEncoder();
  let closed = false;
  let interval: ReturnType<typeof setInterval> | undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const write = (value: string) => {
        if (!closed) controller.enqueue(encoder.encode(value));
      };
      write(frame("ready", { roomId }));
      const poll = async () => {
        if (closed || request.signal.aborted) return;
        try {
          const access = await resolveChatRoomAccess({ roomId, userId: principal.principal.user.id });
          if (access.status !== "active") {
            write(frame("revoked", { reason: "membership_revoked" }));
            closed = true;
            if (interval) clearInterval(interval);
            if (timeout) clearTimeout(timeout);
            controller.close();
            return;
          }
          const rows = await db.select({ event: chatEvents, message: chatMessages, author: users })
            .from(chatEvents)
            .leftJoin(chatMessages, eq(chatMessages.id, chatEvents.messageId))
            .leftJoin(users, eq(users.id, chatMessages.authorUserId))
            .where(and(eq(chatEvents.roomId, roomId), gt(chatEvents.createdAt, new Date(cursor))))
            .orderBy(asc(chatEvents.createdAt)).limit(50);
          for (const row of rows) {
            cursor = Math.max(cursor, row.event.createdAt.getTime());
            write(frame("message", {
              eventId: row.event.id,
              eventType: row.event.eventType,
              message: row.message ? {
                id: row.message.id,
                type: row.message.messageType,
                body: row.message.body,
                createdAt: row.message.createdAt.toISOString(),
                author: row.author ? { id: row.author.id, name: row.author.name || "Team member" } : null,
              } : null,
            }, row.event.id));
          }
        } catch {
          if (interval) clearInterval(interval);
          if (timeout) clearTimeout(timeout);
          write(frame("error", { message: "Messaging is temporarily unavailable." }));
          closed = true;
          controller.close();
        }
      };
      interval = setInterval(() => { void poll(); }, 1000);
      timeout = setTimeout(() => {
        if (closed) return;
        if (interval) clearInterval(interval);
        write(": close\n\n");
        closed = true;
        controller.close();
      }, 25_000);
      request.signal.addEventListener("abort", () => {
        if (closed) return;
        closed = true;
        if (interval) clearInterval(interval);
        if (timeout) clearTimeout(timeout);
        controller.close();
      }, { once: true });
    },
    cancel() {
      closed = true;
      if (interval) clearInterval(interval);
      if (timeout) clearTimeout(timeout);
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
