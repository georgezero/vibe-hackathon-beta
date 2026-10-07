"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { DirectConversationAccess, DirectMessageProjection } from "@/lib/direct-messaging";

function formatTime(value: string) { return new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); }

export default function DirectConversationClient({ conversationId, initialAccess, initialMessages }: { conversationId: string; initialAccess: DirectConversationAccess; initialMessages: DirectMessageProjection[] }) {
  const [access, setAccess] = useState(initialAccess);
  const [messages, setMessages] = useState(initialMessages);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const streamCursor = useRef<string | null>(null);
  const stream = useRef<EventSource | null>(null);
  const polling = useRef<ReturnType<typeof setInterval> | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => {
    void fetch(`/api/direct-messages/conversations/${encodeURIComponent(conversationId)}/read`, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: "{}" });
    const pull = async () => {
      const response = await fetch(`/api/direct-messages/conversations/${encodeURIComponent(conversationId)}`, { credentials: "same-origin", cache: "no-store" });
      if (!response.ok) return;
      const payload = await response.json() as { messages?: DirectMessageProjection[]; access?: DirectConversationAccess };
      if (payload.access) setAccess(payload.access);
      if (payload.messages) setMessages((current) => {
        const byId = new Map(current.map((item) => [item.id, item]));
        for (const item of payload.messages ?? []) byId.set(item.id, item);
        return [...byId.values()].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
      });
    };
    const source = new EventSource(`/api/direct-messages/conversations/${encodeURIComponent(conversationId)}/events`);
    stream.current = source;
    source.addEventListener("message", (event) => {
      const incoming = JSON.parse((event as MessageEvent).data) as DirectMessageProjection;
      setMessages((current) => current.some((item) => item.id === incoming.id) ? current : [...current, incoming]);
      streamCursor.current = (event as MessageEvent).lastEventId || streamCursor.current;
    });
    source.addEventListener("revoked", () => setAccess((current) => ({ ...current, canSend: false, blocked: true })));
    source.onerror = () => { source.close(); if (!polling.current) polling.current = setInterval(() => { void pull(); }, 5000); };
    return () => { source.close(); if (polling.current) clearInterval(polling.current); polling.current = null; };
  }, [conversationId]);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length]);
  async function send() {
    if (!body.trim() || !access.canSend) return;
    setError(null);
    const pending = body; setBody("");
    const response = await fetch(`/api/direct-messages/conversations/${encodeURIComponent(conversationId)}`, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: pending, clientMessageId: `web_${crypto.randomUUID()}` }) });
    const payload = await response.json().catch(() => null) as { id?: string; body?: string; createdAt?: string; error?: string } | null;
    if (!response.ok) { setBody(pending); setError(payload?.error || "Message could not be sent."); return; }
    const messageId = payload?.id;
    const messageBody = payload?.body;
    const messageCreatedAt = payload?.createdAt;
    if (messageId && messageBody && messageCreatedAt) setMessages((current) => current.some((item) => item.id === messageId) ? current : [...current, { id: messageId, author: "self", authorIdentity: initialAccess.participant, body: messageBody, createdAt: messageCreatedAt }]);
  }
  async function toggleBlock() {
    const response = await fetch(`/api/direct-messages/conversations/${encodeURIComponent(conversationId)}/block`, { method: access.blocked ? "DELETE" : "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: "{}" });
    if (response.ok) setAccess((current) => ({ ...current, blocked: !current.blocked, canSend: current.blocked }));
    setMenuOpen(false);
  }
  async function report() {
    await fetch(`/api/direct-messages/conversations/${encodeURIComponent(conversationId)}/report`, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ category: "other" }) });
    setMenuOpen(false); setError("Thanks. Your report was submitted.");
  }
  return <>
    <header className="messages-panel-header"><div className="messages-panel-person"><span className="messages-avatar" aria-hidden="true">{access.participant.initials}</span><div><h2>{access.participant.displayName}</h2>{(access.participant.headline || access.participant.affiliation) && <p>{[access.participant.headline, access.participant.affiliation].filter(Boolean).join(" · ")}</p>}</div></div><div className="messages-panel-actions">{access.participant.handle && !access.participant.isFormerParticipant && <Link className="btn-secondary" href={`/people/${encodeURIComponent(access.participant.handle)}`}>View profile</Link>}<div style={{ position: "relative" }}><button className="btn-secondary" type="button" aria-expanded={menuOpen} onClick={() => setMenuOpen((value) => !value)}>More</button>{menuOpen && <div role="menu" style={{ position: "absolute", right: 0, top: "calc(100% + .35rem)", zIndex: 5, minWidth: "10rem", padding: ".35rem", border: "1px solid var(--color-border)", borderRadius: 10, background: "var(--color-surface)", boxShadow: "var(--shadow-card)" }}><button className="messages-menu-button" role="menuitem" type="button" onClick={() => { void toggleBlock(); }}>{access.blocked ? "Unblock participant" : "Block participant"}</button><button className="messages-menu-button" role="menuitem" type="button" onClick={() => { void report(); }}>Report conversation</button></div>}</div></div></header>
    <div className="messages-stream" aria-live="polite">{messages.map((message) => <article key={message.id} className={`messages-bubble ${message.author === "self" ? "self" : "other"}`}><span>{message.body}</span><time dateTime={message.createdAt}>{formatTime(message.createdAt)}</time></article>)}<div ref={bottom} /></div>
    {access.canSend ? <form className="messages-composer" onSubmit={(event) => { event.preventDefault(); void send(); }}><label htmlFor="direct-message-body" className="sr-only">Write a message</label><textarea id="direct-message-body" value={body} maxLength={4000} onChange={(event) => setBody(event.target.value)} placeholder="Write a message…" /><div className="messages-composer-row"><span className="messages-composer-hint">Plain text · {body.length}/4000</span><button className="btn-primary" type="submit" disabled={!body.trim()}>Send</button></div>{error && <p className="messages-error" role="status">{error}</p>}</form> : <div className="messages-blocked">You can&apos;t send messages in this conversation.{error && <p className="messages-error" role="status">{error}</p>}</div>}
  </>;
}
