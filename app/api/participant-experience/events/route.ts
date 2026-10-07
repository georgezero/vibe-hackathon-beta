import { NextRequest, NextResponse } from "next/server";
import { getActiveEvent } from "@/lib/events";
import { resolveApplicationPrincipal } from "@/lib/application-principal";
import { allowNativeChatAction } from "@/lib/native-chat-rate-limit";
import {
  PARTICIPANT_CONTEXTS,
  PARTICIPANT_DEVICE_CLASSES,
  PARTICIPANT_FAILURE_REASONS,
  PARTICIPANT_JOURNEY_EVENT_TYPES,
  PARTICIPANT_NAV_DESTINATIONS,
  PARTICIPANT_OUTCOMES,
  recordParticipantJourneyEvent,
} from "@/lib/participant-experience";

function enumValue<T extends readonly string[]>(values: T, value: unknown) {
  return value === undefined || value === null ? undefined : values.includes(value as T[number]) ? value as T[number] : null;
}

export async function POST(request: NextRequest) {
  const event = await getActiveEvent();
  const resolution = await resolveApplicationPrincipal(request.headers, { eventId: event.id });
  if (resolution.status !== "authenticated") return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  if (!allowNativeChatAction(`participant-experience:${resolution.principal.user.id}`, 120, 60_000)) {
    return NextResponse.json({ error: "Telemetry is temporarily rate limited." }, { status: 429, headers: { "Cache-Control": "no-store, private" } });
  }
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid telemetry event." }, { status: 400 });
  const eventType = enumValue(PARTICIPANT_JOURNEY_EVENT_TYPES, body.eventType);
  const deviceClass = enumValue(PARTICIPANT_DEVICE_CLASSES, body.deviceClass);
  const source = enumValue(PARTICIPANT_NAV_DESTINATIONS, body.source);
  const destination = enumValue(PARTICIPANT_NAV_DESTINATIONS, body.destination);
  const outcome = enumValue(PARTICIPANT_OUTCOMES, body.outcome);
  const reason = enumValue(PARTICIPANT_FAILURE_REASONS, body.reason);
  const context = enumValue(PARTICIPANT_CONTEXTS, body.context);
  const durationMs = body.durationMs === undefined || body.durationMs === null ? undefined : body.durationMs;
  if (!eventType || deviceClass === null || source === null || destination === null || outcome === null || reason === null || context === null || (durationMs !== undefined && (!Number.isInteger(durationMs) || Number(durationMs) < 0 || Number(durationMs) > 86_400_000))) {
    return NextResponse.json({ error: "Invalid telemetry event." }, { status: 400 });
  }
  await recordParticipantJourneyEvent({
    eventId: event.id,
    eventType,
    participantUserId: resolution.principal.user.id,
    deviceClass,
    source,
    destination,
    outcome,
    reason,
    context,
    durationMs: durationMs as number | undefined,
  });
  return NextResponse.json({ accepted: true }, { headers: { "Cache-Control": "no-store, private" } });
}
