"use client";

import { useEffect, useRef } from "react";
import type { ParticipantDeviceClass, ParticipantExperienceContext, ParticipantJourneyEventType, ParticipantJourneyOutcome, ParticipantNavigationDestination } from "@/lib/participant-experience";

export default function ParticipantJourneyTracker({ eventType, context, source, destination, outcome = "viewed" }: { eventType: ParticipantJourneyEventType; context?: ParticipantExperienceContext; source?: ParticipantNavigationDestination; destination?: ParticipantNavigationDestination; outcome?: ParticipantJourneyOutcome }) {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    const deviceClass: ParticipantDeviceClass = window.matchMedia("(max-width: 680px)").matches ? "mobile" : "desktop";
    void fetch("/api/participant-experience/events", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventType, context, source, destination, outcome, deviceClass }),
      keepalive: true,
    }).catch(() => undefined);
  }, [context, destination, eventType, outcome, source]);
  return null;
}
