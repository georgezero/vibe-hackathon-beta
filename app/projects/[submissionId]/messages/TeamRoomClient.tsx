"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

type Message = { id: string; type: "user_message" | "system_event"; body: string; createdAt: string; editedAt: string | null; deletedAt: string | null; author: { id: string; name: string } | null };

function formatTime(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

export function TeamRoomClient({ submissionId }: { submissionId: string }) {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [realtime, setRealtime] = useState("connecting");
  const endRef = useRef<HTMLDivElement>(null);
  // Event timestamps are SQLite-second precision. Start from zero and let
  // the client de-duplicate against the loaded history; using Date.now() can
  // skip events created in the same second as the initial request.
  const cursorRef = useRef(0);

  const load = useCallback(async () => {
    const response = await fetch(`/api/chat/submissions/${encodeURIComponent(submissionId)}`, { cache: "no-store" });
    if (!response.ok) throw new Error((await response.json().catch(() => null))?.error || "The team room could not be opened.");
    const data = await response.json() as { room: { id: string }; messages: Message[] };
    setRoomId(data.room.id);
    setMessages(data.messages);
    cursorRef.current = 0;
    await fetch(`/api/chat/rooms/${encodeURIComponent(data.room.id)}/read`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }).catch(() => undefined);
  }, [submissionId]);

  useEffect(() => {
    const task = window.setTimeout(() => {
      void load().catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Messaging is temporarily unavailable.")).finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(task);
  }, [load]);

  useEffect(() => {
    if (!roomId) return;
    let source: EventSource | null = null;
    let fallback: ReturnType<typeof setInterval> | undefined;
    const merge = (next: Message) => setMessages((current) => current.some((item) => item.id === next.id) ? current : [...current, next]);
    const poll = async () => {
      const response = await fetch(`/api/chat/submissions/${encodeURIComponent(submissionId)}`, { cache: "no-store" });
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          setRealtime("revoked");
          setError("Your team membership is no longer active.");
        }
        return;
      }
      const data = await response.json() as { messages: Message[] };
      setMessages(data.messages);
    };
    try {
      source = new EventSource(`/api/chat/rooms/${encodeURIComponent(roomId)}/events?after=${cursorRef.current}`);
      source.addEventListener("ready", () => setRealtime("live"));
      source.addEventListener("message", (event) => {
        const payload = JSON.parse((event as MessageEvent).data) as { message?: Message };
        if (payload.message) {
          cursorRef.current = Math.max(cursorRef.current, new Date(payload.message.createdAt).getTime() - 1);
          merge(payload.message);
          void fetch(`/api/chat/rooms/${encodeURIComponent(roomId)}/read`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messageId: payload.message.id }) });
        }
      });
      source.addEventListener("revoked", () => { setRealtime("revoked"); setError("Your team membership is no longer active."); source?.close(); });
      source.onerror = () => { setRealtime("polling"); source?.close(); fallback = setInterval(() => { void poll(); }, 1000); };
    } catch { queueMicrotask(() => setRealtime("polling")); fallback = setInterval(() => { void poll(); }, 1000); }
    return () => { source?.close(); if (fallback) clearInterval(fallback); };
  }, [roomId, submissionId]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const text = body.trim();
    if (!text || !roomId || sending) return;
    setSending(true); setError(null);
    try {
      const response = await fetch(`/api/chat/submissions/${encodeURIComponent(submissionId)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: text, clientMessageId: crypto.randomUUID().replaceAll("-", "") }) });
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.error || "Message could not be sent.");
      const message = await response.json() as Message;
      setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, { ...message, type: "user_message", editedAt: null, deletedAt: null, author: null }]);
      setBody("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Message could not be sent."); } finally { setSending(false); }
  }

  return <section className="workspace-chat" aria-label="Private team messages">
    <header className="workspace-chat-header"><div><strong>Team room</strong><p>Private to active submission members</p></div><span className="badge badge-default" aria-live="polite">{realtime === "live" ? "Live" : realtime === "revoked" ? "Access revoked" : "Updating"}</span></header>
    <div className="workspace-chat-timeline">
      {loading ? <p className="workspace-empty">Loading your team conversation…</p> : messages.length === 0 ? <div className="workspace-empty"><h3>Start your team conversation</h3><p>Coordinate tasks, share links, or let teammates know what you are working on.</p><p className="workspace-chat-privacy">Only active team members can read or post here. Do not share patient information, passwords, private edit tokens, or API keys.</p></div> : <div className="workspace-chat-list">{messages.map((message) => <article className={`workspace-chat-message${message.type === "system_event" ? " workspace-chat-system" : ""}`} key={message.id}><div className="workspace-chat-meta"><strong>{message.type === "system_event" ? "Vibe Hackathon" : message.author?.name || "Team member"}</strong><time dateTime={message.createdAt}>{formatTime(message.createdAt)}</time></div><p className="workspace-chat-body">{message.deletedAt ? "Message deleted" : message.body}</p></article>)}</div>}
      <div ref={endRef} />
    </div>
    {error && <p className="workspace-chat-error" role="alert">{error}</p>}
    <form className="workspace-composer" onSubmit={submit}><label htmlFor="team-message" className="sr-only">Message your team</label><textarea id="team-message" value={body} onChange={(event) => setBody(event.target.value)} maxLength={4000} rows={2} placeholder="Write to your team…" disabled={realtime === "revoked" || loading} /><button className="btn-primary" type="submit" disabled={sending || !body.trim() || realtime === "revoked" || loading}>{sending ? "Sending…" : "Send"}</button></form>
  </section>;
}
