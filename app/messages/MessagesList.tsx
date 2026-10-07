"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { DirectConversationSummary } from "@/lib/direct-messaging";
import { ParticipantEmptyState } from "@/components/ParticipantEmptyState";

function relativeTime(value: string | null) {
  if (!value) return "";
  const age = Date.now() - new Date(value).getTime();
  if (age < 60_000) return "now";
  if (age < 3_600_000) return `${Math.floor(age / 60_000)}m`;
  if (age < 86_400_000) return `${Math.floor(age / 3_600_000)}h`;
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function MessagesList({ conversations, activeId }: { conversations: DirectConversationSummary[]; activeId?: string }) {
  const [current, setCurrent] = useState(conversations);

  // Keep the inbox preview and unread counts useful while another participant
  // sends a reply. The conversation itself owns SSE; this bounded refresh keeps
  // the list lightweight without introducing a second realtime transport.
  useEffect(() => {
    const refresh = async () => {
      const response = await fetch("/api/direct-messages/conversations", { credentials: "same-origin", cache: "no-store" });
      if (!response.ok) return;
      const payload = await response.json() as { conversations?: DirectConversationSummary[] };
      if (Array.isArray(payload.conversations)) setCurrent(payload.conversations);
    };
    const timer = window.setInterval(() => { void refresh(); }, 5000);
    return () => window.clearInterval(timer);
  }, [conversations]);

  return (
    <aside className="messages-list" aria-label="Conversations">
      <div className="messages-list-header">Conversations</div>
      {current.length === 0 ? (
        <ParticipantEmptyState className="messages-empty" compact title="No conversations yet" description="Find a participant in People and choose Message to start a private conversation." action={{ href: "/people", label: "Browse People" }} />
      ) : current.map((conversation) => (
        <Link key={conversation.id} href={`/messages/${encodeURIComponent(conversation.id)}`} className={`messages-conversation-link${activeId === conversation.id ? " is-active" : ""}`}>
          <div className="messages-row-top">
            <div className="messages-identity"><span className="messages-avatar" aria-hidden="true">{conversation.participant.initials}</span><span className="messages-name">{conversation.participant.displayName}</span></div>
            <span className="messages-time">{relativeTime(conversation.latestMessageAt)}</span>
          </div>
          <div className="messages-row-top"><span className="messages-preview">{conversation.latestMessage || "Start a conversation"}</span>{conversation.unreadCount > 0 && <span className="messages-unread" aria-label={`${conversation.unreadCount} unread message${conversation.unreadCount === 1 ? "" : "s"}`}>{conversation.unreadCount > 9 ? "9+" : conversation.unreadCount}</span>}</div>
        </Link>
      ))}
    </aside>
  );
}
