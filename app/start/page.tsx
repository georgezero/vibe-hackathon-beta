import { NavPublic } from "@/components/NavPublic";
import Link from "next/link";
import { EventFreezeBanner } from "@/components/EventFreezeBanner";
import { getActiveEvent, submissionDeadlineStatus } from "@/lib/events";
import { StartClient } from "./StartClient";
import { recordParticipantJourneyEvent } from "@/lib/participant-experience";

export const dynamic = "force-dynamic";

export default async function StartPage() {
  const event = await getActiveEvent();
  const deadline = submissionDeadlineStatus(event);
  void recordParticipantJourneyEvent({ eventId: event.id, eventType: "participant_start_viewed", deviceClass: "unknown", destination: "start", context: "start", outcome: deadline.open ? "viewed" : "guardrail", reason: deadline.open ? undefined : "deadline" });
  if (!deadline.open) return <div className="min-h-screen"><NavPublic /><EventFreezeBanner /><main className="mx-auto w-full max-w-2xl px-4 sm:px-6 py-16"><section className="card" style={{ padding: "1.6rem" }}><h1 style={{ color: "var(--color-fg)", fontFamily: "var(--font-headline)", fontSize: "2rem" }}>Submissions are closed</h1><p style={{ color: "var(--color-muted)", marginTop: "0.7rem", lineHeight: 1.6 }}>{deadline.label}</p><p style={{ color: "var(--color-muted)", marginTop: "0.7rem", lineHeight: 1.6 }}>You can still explore projects and participate in the event community. If you already started a project, you can resume it with your private details.</p><div className="flex flex-wrap gap-2" style={{ marginTop: "1.1rem" }}><Link className="btn-primary" href="/projects">Explore projects</Link><Link className="btn-secondary" href="/start/resume">Resume a project</Link><Link className="btn-secondary" href="/status">View event status</Link></div></section></main></div>;
  return <div className="min-h-screen"><NavPublic /><EventFreezeBanner /><main className="mx-auto w-full max-w-2xl px-4 sm:px-6 py-12"><StartClient eventName={event.name} /></main></div>;
}
