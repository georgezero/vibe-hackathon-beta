import { NextResponse } from "next/server";
import { getActiveEvent } from "@/lib/events";

export function isEventFrozen(event: { isFrozen?: boolean | number | null }) {
  return Boolean(event.isFrozen);
}

export async function getEventFreezeState() {
  const event = await getActiveEvent();
  return { event, frozen: isEventFrozen(event) };
}

export async function assertEventNotFrozen() {
  const { event, frozen } = await getEventFreezeState();
  if (!frozen) return { event, frozen: false as const, response: null };
  return {
    event,
    frozen: true as const,
    response: NextResponse.json(
      { error: "This event is frozen and submissions can no longer be modified.", eventFrozen: true },
      { status: 403 }
    ),
  };
}
