import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { NavPublic } from "@/components/NavPublic";
import { resolveApplicationPrincipal } from "@/lib/application-principal";
import { listDirectConversations } from "@/lib/direct-messaging";
import MessagesList from "./MessagesList";
import ParticipantJourneyTracker from "@/components/ParticipantJourneyTracker";
import { ParticipantEmptyState } from "@/components/ParticipantEmptyState";
import "./messages.css";

export const dynamic = "force-dynamic";

export default async function MessagesPage() {
  const resolution = await resolveApplicationPrincipal(await headers());
  if (resolution.status !== "authenticated") redirect("/login?returnTo=%2Fmessages");
  const conversations = await listDirectConversations(resolution.principal.user.id);
  return <div className="min-h-screen"><ParticipantJourneyTracker eventType="participant_messages_viewed" context="messages" destination="messages" /><NavPublic /><main className="messages-shell"><header className="messages-heading"><div><h1>Messages</h1><p>Private conversations with people you meet across the hackathon.</p></div></header><section className="messages-card"><MessagesList conversations={conversations} />{conversations.length > 0 && <ParticipantEmptyState className="messages-empty" title="Choose a conversation" description="Open a message thread or explore People to find a collaborator." action={{ href: "/people", label: "Browse People", primary: false }} />}</section></main></div>;
}
