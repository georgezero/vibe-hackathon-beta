import { db } from "@/lib/db";
import { events } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";

export type EventRow = Awaited<ReturnType<typeof getActiveEvent>>;

export async function getActiveEvent() {
  const active = await db.select().from(events).where(eq(events.isActive, true));
  if (active[0]) return active[0];

  const existing = await db.select().from(events).orderBy(desc(events.createdAt));
  if (existing[0]) return existing[0];

  const event = {
    id: `evt_${nanoid(8)}`,
    name: "Vibe Hackathon 2025",
    slug: "vibe-hackathon-2025",
    isActive: true,
    audienceVotingEnabled: true,
    audienceAwardCount: 1,
    audienceVotesPerPerson: 1,
    audienceResultsVisible: true,
    winnersPublishedAt: null as Date | null,
    showJudgeChoice: true,
    showPeoplesChoice: true,
    showAIChoice: true,
    showSpecialAwards: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  try {
    await db.insert(events).values(event);
    return event;
  } catch {
    const created = await db.select().from(events).where(eq(events.slug, "vibe-hackathon-2025"));
    if (created[0]) return created[0];
    throw new Error("Failed to create or load default active event");
  }
}

export async function getAllEvents() {
  return db.select().from(events).orderBy(desc(events.createdAt));
}

// ── Deadline helpers ──────────────────────────────────────────────────────────

function daysUntil(date: Date): number {
  return Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export function submissionDeadlineStatus(event: EventRow) {
  const deadline = event.submissionDeadline;
  if (!deadline) return { open: true, label: "Submissions open (no deadline set)", daysRemaining: null };
  // `daysUntil` is intentionally rounded up for friendly copy ("close today"
  // during the final 24 hours). Authorization must use the exact server time,
  // otherwise a project could still be finalized for almost a day after the
  // configured deadline.
  if (Date.now() >= deadline.getTime()) return { open: false, label: `Submissions closed (${deadline.toLocaleDateString()})`, daysRemaining: null };
  const days = daysUntil(deadline);
  if (days === 0) return { open: true, label: "Submissions close today", daysRemaining: 0 };
  return { open: true, label: `Submissions open — ${days} day${days === 1 ? "" : "s"} remaining`, daysRemaining: days };
}

export function judgingDeadlineStatus(event: EventRow) {
  const deadline = event.judgingDeadline;
  if (!deadline) return { open: true, label: "Judging open (no deadline set)", daysRemaining: null };
  if (Date.now() >= deadline.getTime()) return { open: false, label: `Judging closed (${deadline.toLocaleDateString()})`, daysRemaining: null };
  const days = daysUntil(deadline);
  if (days === 0) return { open: true, label: "Judging closes today", daysRemaining: 0 };
  return { open: true, label: `Judging open — ${days} day${days === 1 ? "" : "s"} remaining`, daysRemaining: days };
}

export function audienceVotingStatus(event: EventRow) {
  const now = Date.now();
  const startsAt = event.audienceVotingStartsAt?.getTime();
  const endsAt = event.audienceVotingEndsAt?.getTime();
  const modeEnabled = (event as EventRow & { audienceVotingMode?: string }).audienceVotingMode !== "disabled";
  const open =
    event.audienceVotingEnabled &&
    modeEnabled &&
    (!startsAt || now >= startsAt) &&
    (!endsAt || now <= endsAt);
  const label = !event.audienceVotingEnabled || !modeEnabled
    ? "Audience voting disabled"
    : startsAt && now < startsAt
    ? "Audience voting not open yet"
    : endsAt && now > endsAt
    ? "Audience voting closed"
    : "Audience voting open";
  const identityMethod = (event as EventRow & { audienceIdentityMethod?: string }).audienceIdentityMethod ?? "anonymous";
  const votingMode = (event as EventRow & { audienceVotingMode?: string }).audienceVotingMode ?? "disabled";
  return { open, label, resultsVisible: !!event.audienceResultsVisible, identityMethod, votingMode };
}

export function eventPhase(event: EventRow): "submissions_open" | "submissions_closed" | "judging" | "judging_closed" | "winners_published" {
  if (event.winnersPublishedAt) return "winners_published";
  const subStatus = submissionDeadlineStatus(event);
  const judgeStatus = judgingDeadlineStatus(event);
  if (!judgeStatus.open) return "judging_closed";
  if (!subStatus.open) return "judging";
  return "submissions_open";
}
