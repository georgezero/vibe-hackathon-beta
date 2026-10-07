import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { NavPublic } from "@/components/NavPublic";
import { resolveApplicationPrincipal } from "@/lib/application-principal";
import { listDirectConversations, listDirectMessages, resolveDirectConversationAccess } from "@/lib/direct-messaging";
import MessagesList from "../MessagesList";
import DirectConversationClient from "./DirectConversationClient";
import "../messages.css";

export const dynamic = "force-dynamic";

export default async function DirectConversationPage({ params }: { params: Promise<{ conversationId: string }> }) {
  const resolution = await resolveApplicationPrincipal(await headers());
  if (resolution.status !== "authenticated") redirect("/login?returnTo=%2Fmessages");
  const { conversationId } = await params;
  const data = await Promise.all([
    resolveDirectConversationAccess({ conversationId, userId: resolution.principal.user.id }),
    listDirectMessages({ conversationId, userId: resolution.principal.user.id }),
    listDirectConversations(resolution.principal.user.id),
  ]).catch(() => null);
  if (!data) {
    return <div className="min-h-screen"><NavPublic /><main className="messages-shell"><section className="card messages-empty"><div><h1>Conversation unavailable</h1><p>This conversation is not available to this account.</p><Link className="btn-secondary" href="/messages">Back to messages</Link></div></section></main></div>;
  }
  const [access, initial, conversations] = data;
  return <div className="min-h-screen"><NavPublic /><main className="messages-shell"><div className="messages-card"><MessagesList conversations={conversations} activeId={conversationId} /><section className="messages-panel"><Link className="messages-mobile-back" href="/messages">← All messages</Link><DirectConversationClient conversationId={conversationId} initialAccess={access} initialMessages={initial.messages} /></section></div></main></div>;
}
