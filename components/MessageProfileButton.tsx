"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function MessageProfileButton({ handle }: { handle: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function start() {
    setBusy(true); setError(null);
    void fetch("/api/participant-experience/events", {
      method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventType: "participant_message_initiated", context: "people", source: "people", destination: "messages", outcome: "started", deviceClass: window.matchMedia("(max-width: 680px)").matches ? "mobile" : "desktop" }), keepalive: true,
    }).catch(() => undefined);
    try {
      const response = await fetch("/api/direct-messages/conversations", {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle }),
      });
      const payload = await response.json().catch(() => null) as { conversationId?: string; error?: string } | null;
      if (!response.ok || !payload?.conversationId) throw new Error(payload?.error || "Messaging is unavailable.");
      router.push(`/messages/${encodeURIComponent(payload.conversationId)}`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Messaging is unavailable."); setBusy(false); }
  }
  return (
    <span className="profile-message-action">
      <button className="btn-primary" type="button" onClick={() => { void start(); }} disabled={busy}>
        {busy ? "Opening…" : "Message"}
      </button>
      {error && <span className="profile-message-error" role="alert">{error}</span>}
    </span>
  );
}
