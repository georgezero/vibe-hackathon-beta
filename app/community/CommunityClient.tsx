"use client";

import Link from "next/link";
import { Fragment, useEffect, useRef, useState } from "react";
import type { CommunityChannelSummary, CommunityMessageProjection } from "@/lib/community-channels";
import { communityMessageDateKey, communityMessageDateLabel, isCommunityMessageContinuation } from "@/lib/community-presentation";
import { ParticipantEmptyState } from "@/components/ParticipantEmptyState";

type Channel = CommunityChannelSummary;

function renderChannel(channel: Channel, selectedSlug?: string) {
  return <Link key={channel.id} className={`community-channel-link${selectedSlug === channel.slug ? " is-active" : ""}${channel.status === "archived" ? " is-archived" : ""}`} href={`/community/${encodeURIComponent(channel.slug)}`}>
    <div className="community-channel-row">
      <span className="community-channel-name"># {channel.name}</span>
      {channel.unreadCount > 0 && <span className="community-channel-unread" aria-label={`${channel.unreadCount} unread messages`}>{channel.unreadCount > 9 ? "9+" : channel.unreadCount}</span>}
    </div>
    <p className="community-channel-description">{channel.description}</p>
    <span className="community-channel-type">{channel.status === "archived" ? "Archived" : channel.type === "announcements" ? "Organizer updates" : "Discussion"}</span>
  </Link>;
}

export default function CommunityClient({ eventName, channels, selectedSlug, initialMessages, initialHasMore, initialChannel }: { eventName: string; channels: Channel[]; selectedSlug?: string; initialMessages?: CommunityMessageProjection[]; initialHasMore?: boolean; initialChannel?: Channel }) {
  const activeChannels = channels.filter((channel) => channel.status !== "archived");
  const archivedChannels = channels.filter((channel) => channel.status === "archived");
  return <>
    <header className="community-heading"><div><h1>Community</h1><p>Talk with other {eventName} participants, find collaborators, and share what you are building.</p></div><Link className="btn-secondary" href="/people">Explore people</Link></header>
    <section className="community-card">
      <nav className="community-channel-list" aria-label="Community channels">
        <div className="community-list-label">Event channels</div>
        {activeChannels.map((channel) => renderChannel(channel, selectedSlug))}
        {archivedChannels.length > 0 && <div className="community-archive-label">Archived</div>}
        {archivedChannels.map((channel) => renderChannel(channel, selectedSlug))}
      </nav>
      {selectedSlug && initialMessages && initialChannel ? <CommunityConversationClient key={selectedSlug} channel={initialChannel} initialMessages={initialMessages} initialHasMore={initialHasMore ?? false} /> : <ParticipantEmptyState className="community-empty" title="Choose a channel" description="Start with General for event-wide conversation, or open Team-up to find people to build with." action={{ href: activeChannels[0] ? `/community/${encodeURIComponent(activeChannels[0].slug)}` : "/people", label: activeChannels[0] ? "Open General" : "Browse People" }} />}
    </section>
  </>;
}

function messageTime(value: string) {
  return new Date(value).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function CommunityConversationClient({ channel, initialMessages, initialHasMore }: { channel: Channel; initialMessages: CommunityMessageProjection[]; initialHasMore: boolean }) {
  const [messages, setMessages] = useState(initialMessages);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [reporting, setReporting] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [showNewMessages, setShowNewMessages] = useState(false);
  const streamRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef("");
  const atBottomRef = useRef(true);

  useEffect(() => {
    void fetch(`/api/community/${encodeURIComponent(channel.slug)}/read`, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
    const source = new EventSource(`/api/community/${encodeURIComponent(channel.slug)}/events`);
    source.addEventListener("message", (event) => {
      const payload = JSON.parse((event as MessageEvent).data) as CommunityMessageProjection;
      cursorRef.current = (event as MessageEvent).lastEventId || cursorRef.current;
      const shouldStick = atBottomRef.current;
      if (!shouldStick) setShowNewMessages(true);
      setMessages((current) => current.some((item) => item.id === payload.id) ? current : [...current, payload]);
    });
    source.addEventListener("archived", () => source.close());
    source.onerror = () => source.close();
    return () => source.close();
  }, [channel.slug]);

  useEffect(() => {
    if (!atBottomRef.current) return;
    const frame = requestAnimationFrame(() => {
      const stream = streamRef.current;
      if (stream) stream.scrollTop = stream.scrollHeight;
    });
    return () => cancelAnimationFrame(frame);
  }, [messages.length]);

  function updateScrollPosition() {
    const stream = streamRef.current;
    if (!stream) return;
    const atBottom = stream.scrollHeight - stream.scrollTop - stream.clientHeight < 72;
    atBottomRef.current = atBottom;
    if (atBottom) setShowNewMessages(false);
  }

  function scrollToBottom() {
    const stream = streamRef.current;
    if (!stream) return;
    atBottomRef.current = true;
    setShowNewMessages(false);
    stream.scrollTo({ top: stream.scrollHeight, behavior: "smooth" });
  }

  async function send() {
    if (!body.trim() || channel.status === "archived" || !channel.canPost) return;
    const text = body.trim();
    const shouldStick = atBottomRef.current;
    setError(null);
    setBody("");
    try {
      const response = await fetch(`/api/community/${encodeURIComponent(channel.slug)}`, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: text, clientMessageId: `web-${Date.now()}-${Math.random().toString(36).slice(2)}` }) });
      const payload = await response.json().catch(() => null) as { id?: string; body?: string; createdAt?: string; error?: string } | null;
      if (!response.ok) throw new Error(payload?.error || "Message could not be sent.");
      if (!shouldStick) setShowNewMessages(true);
      setMessages((current) => current.some((item) => item.id === payload?.id) ? current : [...current, { id: payload?.id || `local-${Date.now()}`, body: payload?.body || text, createdAt: payload?.createdAt || new Date().toISOString(), author: { displayName: "You", initials: "YO", handle: null, headline: null, affiliation: null }, isRemoved: false, canReport: false, isOwn: true }]);
    } catch (cause) {
      setBody(text);
      setError(cause instanceof Error ? cause.message : "Message could not be sent.");
    }
  }

  async function loadOlder() {
    const first = messages[0];
    const stream = streamRef.current;
    if (!first || !stream) return;
    const previousHeight = stream.scrollHeight;
    const previousTop = stream.scrollTop;
    const response = await fetch(`/api/community/${encodeURIComponent(channel.slug)}?before=${encodeURIComponent(first.createdAt)}`);
    const payload = await response.json() as { messages?: CommunityMessageProjection[]; hasMore?: boolean };
    setMessages((current) => [...(payload.messages || []), ...current]);
    setHasMore(Boolean(payload.hasMore));
    requestAnimationFrame(() => { if (streamRef.current) streamRef.current.scrollTop = streamRef.current.scrollHeight - previousHeight + previousTop; });
  }

  async function report(messageId: string) {
    setReporting(messageId);
    const response = await fetch(`/api/community/${encodeURIComponent(channel.slug)}/report`, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messageId, category: "other" }) });
    setReporting(null);
    if (!response.ok) setError("That message could not be reported.");
    else setError("Message reported to the organizers.");
  }

  return <section className="community-panel">
    <Link className="community-mobile-back" href="/community">← All channels</Link>
    <header className="community-panel-header"><div className="community-panel-title"><h2># {channel.name}</h2><p>{channel.description}</p></div><div className="community-panel-actions">{channel.status === "archived" && <span className="community-archive-badge">Archived</span>}</div></header>
    <div className="community-stream" ref={streamRef} onScroll={updateScrollPosition} aria-live="polite">
      {hasMore && <button type="button" className="btn-ghost community-load-older" onClick={() => { void loadOlder(); }}>Load older messages</button>}
      {messages.length === 0 ? <ParticipantEmptyState className="community-empty" compact title={emptyChannelTitle(channel)} description={emptyChannelDescription(channel)} /> : messages.map((message, index) => {
        const previous = messages[index - 1];
        const dateBreak = !previous || communityMessageDateKey(previous.createdAt) !== communityMessageDateKey(message.createdAt);
        const grouped = isCommunityMessageContinuation(previous, message);
        const moderation = message.isRemoved;
        const messageLabel = moderation ? "Message removed by an organizer" : `${message.author.displayName}, ${messageTime(message.createdAt)}: ${message.body}`;
        return <Fragment key={message.id}>
          {dateBreak && <div className="community-date-separator" role="separator"><span>{communityMessageDateLabel(message.createdAt)}</span></div>}
          <article className={`community-message${grouped ? " is-grouped" : ""}${message.isOwn && !moderation ? " is-own" : ""}${moderation ? " is-moderation" : ""}`} aria-label={messageLabel}>
            <div className="community-message-avatar" aria-hidden="true">{moderation ? "—" : message.author.initials}</div>
            <div className="community-message-body">
              <div className="community-message-meta">
                {moderation ? <span className="community-message-name">Organizer moderation</span> : <span className={`community-message-name${grouped ? " is-continuation" : ""}`}>{message.author.handle ? <Link href={`/people/${encodeURIComponent(message.author.handle)}`}>{message.author.displayName}</Link> : message.author.displayName}{message.isOwn && !grouped && <span className="community-message-you">You</span>}</span>}
                <time className={`community-message-time${grouped ? " is-continuation" : ""}`} dateTime={message.createdAt}>{messageTime(message.createdAt)}</time>
                {!grouped && !moderation && channel.type === "announcements" && <span className="community-message-kind">Organizer update</span>}
                {!moderation && message.canReport && <span className="community-message-actions"><button className="community-message-report" type="button" onClick={() => { void report(message.id); }} disabled={reporting === message.id} aria-label={`Report message from ${message.author.displayName}`}><span aria-hidden="true">•••</span><span className="sr-only">Report message from {message.author.displayName}</span></button></span>}
              </div>
              <p className={`community-message-text${moderation ? " is-removed" : ""}`}>{message.body}</p>
            </div>
          </article>
        </Fragment>;
      })}
      {showNewMessages && <button type="button" className="community-new-messages" onClick={scrollToBottom}>New messages ↓</button>}
    </div>
    {channel.status === "archived" ? <div className="community-blocked">This channel is archived and read-only. Its conversation remains available for context.</div> : !channel.canPost ? <div className="community-blocked">Only organizers can post in this channel. Check back here for official updates.</div> : <form className="community-composer" onSubmit={(event) => { event.preventDefault(); void send(); }}><label htmlFor="community-message-body" className="sr-only">Write a message</label><textarea id="community-message-body" value={body} onChange={(event) => setBody(event.target.value)} maxLength={4000} placeholder="Write to the event community…" /><div className="community-composer-row"><span className="community-composer-hint">Plain text · {body.length}/4000</span><button className="btn-primary" type="submit" disabled={!body.trim()}>Send</button></div>{error && <p className="community-error" role="status">{error}</p>}</form>}
  </section>;
}

function emptyChannelTitle(channel: Channel) {
  if (channel.type === "announcements") return "No announcements yet";
  if (channel.slug === "team-up") return "Find your collaborators";
  if (channel.slug === "technical-help") return "Ask the first question";
  return "Start the conversation";
}

function emptyChannelDescription(channel: Channel) {
  if (channel.type === "announcements") return "Official event updates will appear here.";
  if (channel.slug === "team-up") return "Share what you want to build or the skills you are looking for. Being first is welcome.";
  if (channel.slug === "technical-help") return "Ask an implementation question or share something that worked for your project.";
  return "Introduce yourself, share what you are building, or ask the event community a question.";
}
