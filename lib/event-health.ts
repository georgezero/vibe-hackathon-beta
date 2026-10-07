import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  submissionMemberships,
  submissionOwners,
  submissions,
  teamMembers,
  teamOwners,
} from "@/lib/db/schema";
import { getActiveEvent, eventPhase } from "@/lib/events";
import { computeSubmissionReadiness } from "@/lib/submission-readiness";
import { getJudgingCommandCenterData } from "@/lib/judging-command-center";
import { getResultsData } from "@/lib/results";
import { getCalibrationData } from "@/lib/calibration";
import { getPublicationData } from "@/lib/publication";

export type EventHealthState = "healthy" | "attention" | "blocked" | "ready";
export type AttentionSeverity = "blocker" | "action" | "watch";

export type AttentionItem = {
  id: string;
  severity: AttentionSeverity;
  category: "submissions" | "access" | "judging" | "results" | "calibration" | "publication";
  title: string;
  explanation: string;
  affected: string;
  why: string;
  recommendation: string;
  href: string;
  createdAt: string | null;
};

export type EventHealthDomain = {
  id: "submissions" | "judging" | "results" | "publication";
  label: string;
  state: EventHealthState;
  headline: string;
  explanation: string;
  href: string;
  metrics: Array<{ label: string; value: number | string }>;
};

export type EventHealthData = {
  event: { id: string; name: string; phase: string; phaseLabel: string; isFrozen: boolean };
  overall: { state: EventHealthState; label: string; summary: string };
  domains: EventHealthDomain[];
  attention: {
    items: AttentionItem[];
    summary: { total: number; blockers: number; actions: number; watch: number; mostImportant: AttentionItem | null };
  };
};

export type EventHealthEvaluationInput = {
  phase: string;
  submissions: { incomplete: number; ownershipProblems: number; notReadyForJudging: number };
  judging: { coverageBlocked: number; replacementRequired: number; staleDrafts: number; missingEvaluations: number };
  results: { incomplete: number; pendingTies: number; highVariance: number; consensusPending: number };
  publication: { blockers: number; ready: boolean; published: boolean };
};

export function evaluateEventHealth(input: EventHealthEvaluationInput): { state: EventHealthState; summary: string } {
  if (input.submissions.ownershipProblems > 0) {
    return { state: "blocked", summary: `${input.submissions.ownershipProblems} submission${input.submissions.ownershipProblems === 1 ? " has" : "s have"} an ownership problem that prevents safe operation.` };
  }
  if (input.judging.coverageBlocked > 0) {
    return { state: "blocked", summary: `${input.judging.coverageBlocked} finalized submission${input.judging.coverageBlocked === 1 ? " is" : "s are"} missing valid judging coverage.` };
  }
  if (input.results.incomplete > 0 && ["judging_closed", "results", "publication"].includes(input.phase)) {
    return { state: "blocked", summary: `${input.results.incomplete} submission${input.results.incomplete === 1 ? " is" : "s are"} not rankable because required evaluations are incomplete.` };
  }
  if (input.publication.blockers > 0) {
    return { state: "blocked", summary: `${input.publication.blockers} publication blocker${input.publication.blockers === 1 ? " remains" : "s remain"}.` };
  }

  const actionCount = input.judging.replacementRequired + input.judging.staleDrafts + input.judging.missingEvaluations
    + input.results.pendingTies + input.results.consensusPending + input.submissions.incomplete + input.submissions.notReadyForJudging;
  if (actionCount > 0 || input.results.highVariance > 0) {
    return { state: "attention", summary: `${actionCount + input.results.highVariance} operational item${actionCount + input.results.highVariance === 1 ? " needs" : "s need"} attention.` };
  }
  if (input.publication.ready && !input.publication.published) {
    return { state: "ready", summary: "Judging and review are complete; the participant publication remains private until an administrator publishes it." };
  }
  return { state: "healthy", summary: "No blocking or actionable event-health conditions are currently detected." };
}

const SEVERITY_ORDER: Record<AttentionSeverity, number> = { blocker: 0, action: 1, watch: 2 };
const CATEGORY_ORDER: Record<AttentionItem["category"], number> = { judging: 0, submissions: 1, access: 2, results: 3, calibration: 4, publication: 5 };

export function assignmentInspectorHref(assignmentId: string) {
  return `/admin/judging?assignment=${encodeURIComponent(assignmentId)}`;
}

/** Keep one primary item per root cause, then present the most consequential work first. */
export function deduplicateAttentionItems(items: AttentionItem[]): AttentionItem[] {
  const byRoot = new Map<string, AttentionItem>();
  for (const item of items) {
    const root = item.id.split(":").slice(0, 2).join(":");
    const existing = byRoot.get(root);
    if (!existing || SEVERITY_ORDER[item.severity] < SEVERITY_ORDER[existing.severity]) byRoot.set(root, item);
  }
  return [...byRoot.values()].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || CATEGORY_ORDER[a.category] - CATEGORY_ORDER[b.category] || a.title.localeCompare(b.title));
}

function phaseLabel(phase: string, publicationStatus: string) {
  if (publicationStatus === "published" || publicationStatus === "archived") return publicationStatus === "archived" ? "Archived" : "Published";
  if (publicationStatus === "approved") return "Ready for publication";
  if (publicationStatus === "reviewed") return "Results under review";
  if (phase === "submissions_open") return "Submissions open";
  if (phase === "judging") return "Judging in progress";
  if (phase === "judging_closed") return "Judging complete";
  return "Results under review";
}

type SubmissionRecord = typeof submissions.$inferSelect;
type MemberRecord = typeof teamMembers.$inferSelect;

async function loadReadiness(eventId: string, rows: SubmissionRecord[]) {
  const ids = rows.map((row) => row.id);
  const memberRows: MemberRecord[] = ids.length ? await db.select().from(teamMembers).where(inArray(teamMembers.submissionId, ids)) : [];
  const membersBySubmission = new Map<string, MemberRecord[]>();
  for (const member of memberRows) membersBySubmission.set(member.submissionId, [...(membersBySubmission.get(member.submissionId) ?? []), member]);
  const activeMembershipOwners: Array<{ submissionId: string }> = ids.length ? await db.select({ submissionId: submissionMemberships.submissionId }).from(submissionMemberships).where(and(inArray(submissionMemberships.submissionId, ids), eq(submissionMemberships.status, "active"), eq(submissionMemberships.role, "owner"))) : [];
  const githubOwners: Array<{ submissionId: string }> = ids.length ? await db.select({ submissionId: submissionOwners.submissionId }).from(submissionOwners).where(inArray(submissionOwners.submissionId, ids)) : [];
  const legacyOwners: Array<{ teamId: string }> = await db.select({ teamId: teamOwners.teamId }).from(teamOwners);
  const owned = new Set<string>([
    ...activeMembershipOwners.map((row) => row.submissionId),
    ...githubOwners.map((row) => row.submissionId),
  ]);
  const ownerTeamIds = new Set(legacyOwners.map((row) => row.teamId));
  for (const row of rows) if (row.teamId && ownerTeamIds.has(row.teamId)) owned.add(row.id);
  const readiness = rows.map((row) => ({ row, result: computeSubmissionReadiness(row, (membersBySubmission.get(row.id) ?? []).map((member) => ({ name: member.name, badgeNumber: member.badgeNumber, isStudentTrainee: member.isStudentTrainee }))), hasOwner: owned.has(row.id) || !row.teamId }));
  void eventId;
  return readiness;
}

export async function getEventHealthData(eventId?: string): Promise<EventHealthData | null> {
  const event = await getActiveEvent();
  if (!event || (eventId && event.id !== eventId)) return null;
  const rows: SubmissionRecord[] = await db.select().from(submissions).where(eq(submissions.eventId, event.id));
  const [readinessRows, judging, results, calibration, publication] = await Promise.all([
    loadReadiness(event.id, rows),
    getJudgingCommandCenterData(event.id),
    getResultsData(event.id),
    getCalibrationData(event.id),
    getPublicationData(event.id),
  ]);
  const finalized = rows.filter((row) => row.status === "submitted" || row.status === "finalized" || row.status === "locked");
  const incomplete = readinessRows.filter((item) => item.result.status === "incomplete");
  const ownershipProblems = readinessRows.filter((item) => !item.hasOwner).length;
  const notReadyForJudging = finalized.filter((row) => readinessRows.find((item) => item.row.id === row.id)?.result.status !== "finalized").length;
  const coverageBlocked = judging.submissions.filter((row) => finalized.some((submission) => submission.id === row.id) && row.assigned === 0).length;
  const replacementRequired = judging.submissions.filter((row) => row.conflict).length;
  const staleDrafts = judging.assignments.filter((row) => (row.evaluation === "draft" || row.evaluation === "reopened") && row.lastSaved && Date.now() - Date.parse(row.lastSaved) > 24 * 60 * 60 * 1000).length;
  const pendingTies = results.summary.pendingTieReviews;
  const consensusPending = calibration.metrics.consensusReviewsPending;
  const publicationBlockers = results.summary.incompleteSubmissions > 0 || pendingTies > 0 || consensusPending > 0 || publication.summary.readyToPublish === 0 || publication.summary.awards === 0 ? 1 : 0;
  const publicationReady = publication.summary.readyToPublish > 0 && results.summary.incompleteSubmissions === 0 && pendingTies === 0 && consensusPending === 0;
  const publicationPublished = publication.release.status === "published" || publication.release.status === "archived";
  const phase = eventPhase(event);
  const overall = evaluateEventHealth({ phase, submissions: { incomplete: incomplete.length, ownershipProblems, notReadyForJudging }, judging: { coverageBlocked, replacementRequired, staleDrafts, missingEvaluations: judging.metrics.missing }, results: { incomplete: results.summary.incompleteSubmissions, pendingTies, highVariance: calibration.metrics.highDisagreementProjects, consensusPending }, publication: { blockers: publicationPublished ? 0 : publicationBlockers, ready: publicationReady, published: publicationPublished } });

  const attention: AttentionItem[] = [];
  for (const row of judging.submissions) {
    const finalizedRow = finalized.some((submission) => submission.id === row.id);
    const conflictAssignment = judging.assignments.find((assignment) => assignment.submissionId === row.id && assignment.state === "active" && assignment.conflictStatus !== "clear");
    if (row.conflict && finalizedRow) attention.push({ id: `coverage:${row.id}:replacement`, severity: row.assigned === 0 ? "blocker" : "action", category: "judging", title: "Replacement judge needed", explanation: `${row.projectTitle} has a conflict or recusal on an active judging path.`, affected: row.projectTitle, why: "Recused work cannot count toward required coverage.", recommendation: "Open the assignment inspector and record the conflict or reassign a replacement judge.", href: conflictAssignment ? assignmentInspectorHref(conflictAssignment.id) : `/admin/judging?submission=${encodeURIComponent(row.id)}`, createdAt: row.lastActivity });
    else if (row.assigned === 0 && finalizedRow) attention.push({ id: `coverage:${row.id}:missing`, severity: "blocker", category: "judging", title: "Judging coverage missing", explanation: `${row.projectTitle} is finalized but has no active judging assignment.`, affected: row.projectTitle, why: "The project cannot be ranked safely without eligible coverage.", recommendation: "Open Judging and assign an eligible judge.", href: `/admin/judging?submission=${encodeURIComponent(row.id)}`, createdAt: row.lastActivity });
    else if (row.missing > 0 && finalizedRow) attention.push({ id: `evaluation:${row.id}:missing`, severity: phase === "judging_closed" ? "blocker" : "action", category: "judging", title: "Required evaluation missing", explanation: `${row.projectTitle} is missing ${row.missing} required evaluation${row.missing === 1 ? "" : "s"}.`, affected: row.projectTitle, why: "Incomplete reviews keep the project unranked or provisional.", recommendation: "Open Judging and follow up with the assigned judge.", href: `/admin/judging?submission=${encodeURIComponent(row.id)}`, createdAt: row.lastActivity });
  }
  for (const row of readinessRows.filter((item) => item.result.status === "incomplete").slice(0, 20)) attention.push({ id: `submission:${row.row.id}:readiness`, severity: "action", category: "submissions", title: "Submission needs readiness work", explanation: `${row.row.projectTitle || row.row.teamName} is missing ${row.result.missingItems.length} readiness item${row.result.missingItems.length === 1 ? "" : "s"}.`, affected: row.row.projectTitle || row.row.teamName, why: "Incomplete submissions may not be ready for judging or finalization.", recommendation: "Open Submission Readiness and inspect the missing items.", href: `/admin/dashboard/submission-readiness?submission=${encodeURIComponent(row.row.id)}`, createdAt: row.row.createdAt?.toISOString() ?? null });
  const finalizedNeedsResultReview = results.rows.filter((row) => row.tieStatus === "pending" && row.completedReviews > 0 && !attention.some((item) => item.id.startsWith(`coverage:${row.submissionId}:`)));
  for (const row of finalizedNeedsResultReview) attention.push({ id: `results:${row.submissionId}:tie`, severity: "action", category: "results", title: "Tie review needed", explanation: `${row.projectTitle} is part of a pending tie group at ${row.score ?? "—"}.`, affected: row.projectTitle, why: "The ranking is not fully reviewed until the tie is resolved.", recommendation: "Open Results and review the tie group.", href: `/admin/results?submission=${encodeURIComponent(row.submissionId)}`, createdAt: null });
  for (const row of calibration.submissions.filter((item) => item.consensusStatus === "suggested" || item.consensusStatus === "in_review" || item.consensusStatus === "flagged").slice(0, 20)) if (!attention.some((item) => item.id.startsWith(`coverage:${row.submissionId}:`))) attention.push({ id: `consensus:${row.submissionId}:pending`, severity: "action", category: "calibration", title: "Consensus review pending", explanation: `${row.projectTitle} has a calibration or consensus signal requiring organizer review.`, affected: row.projectTitle, why: "The score evidence is advisory but should be discussed before close or publication.", recommendation: "Open Calibration and record or complete the consensus review.", href: `/admin/calibration?submission=${encodeURIComponent(row.submissionId)}`, createdAt: null });
  for (const row of calibration.submissions.filter((item) => item.needsReview && !item.finalist && item.consensusStatus === "not_required").slice(0, 10)) if (!attention.some((item) => item.id.startsWith(`coverage:${row.submissionId}:`))) attention.push({ id: `variance:${row.submissionId}:watch`, severity: "watch", category: "calibration", title: "High score variance", explanation: `${row.projectTitle} has a spread of ${row.spread ?? "—"} across completed reviews.`, affected: row.projectTitle, why: "Large disagreement is useful context for a human review, not an automatic score change.", recommendation: "Open Calibration to inspect the criterion and judge distributions.", href: `/admin/calibration?submission=${encodeURIComponent(row.submissionId)}`, createdAt: null });
  if (!publicationPublished && publicationBlockers > 0 && results.summary.incompleteSubmissions === 0 && pendingTies === 0 && consensusPending === 0) attention.push({ id: "publication:blockers:review", severity: "action", category: "publication", title: "Publication readiness needs review", explanation: "The publication payload is not yet marked ready by the publication tool.", affected: event.name, why: "Publishing should remain deliberate until awards, feedback, and preview content are complete.", recommendation: "Open Publication and resolve the listed blockers before approval.", href: "/admin/publication", createdAt: null });
  const deduped = deduplicateAttentionItems(attention);
  const domains: EventHealthDomain[] = [
    { id: "submissions", label: "Submissions", state: ownershipProblems > 0 ? "blocked" : incomplete.length > 0 || notReadyForJudging > 0 ? "attention" : "healthy", headline: `${finalized.length} finalized of ${rows.length}`, explanation: ownershipProblems > 0 ? `${ownershipProblems} submission${ownershipProblems === 1 ? " lacks" : "s lack"} a valid owner.` : incomplete.length > 0 ? `${incomplete.length} submission${incomplete.length === 1 ? " needs" : "s need"} readiness work.` : "Finalized submissions have the expected readiness signal.", href: "/admin/dashboard/submission-readiness", metrics: [{ label: "Total", value: rows.length }, { label: "Finalized", value: finalized.length }, { label: "Needs attention", value: incomplete.length + ownershipProblems }] },
    { id: "judging", label: "Judging", state: coverageBlocked > 0 ? "blocked" : replacementRequired + staleDrafts + judging.metrics.missing > 0 ? "attention" : "healthy", headline: `${judging.metrics.completionPercent}% complete`, explanation: coverageBlocked > 0 ? `${coverageBlocked} finalized submission${coverageBlocked === 1 ? " has" : "s have"} no valid coverage.` : `${judging.metrics.missing} evaluation${judging.metrics.missing === 1 ? " remains" : "s remain"} outstanding across ${judging.metrics.activeJudges} active judges.`, href: "/admin/judging", metrics: [{ label: "Active judges", value: judging.metrics.activeJudges }, { label: "Assignments", value: judging.metrics.assigned }, { label: "Missing", value: judging.metrics.missing }, { label: "Conflicts", value: replacementRequired }] },
    { id: "results", label: "Results", state: results.summary.incompleteSubmissions > 0 ? "blocked" : pendingTies + consensusPending + calibration.metrics.highDisagreementProjects > 0 ? "attention" : "healthy", headline: `${results.summary.rankedSubmissions} ranked`, explanation: results.summary.incompleteSubmissions > 0 ? `${results.summary.incompleteSubmissions} submission${results.summary.incompleteSubmissions === 1 ? " is" : "s are"} not rankable yet.` : `${pendingTies} pending tie${pendingTies === 1 ? "" : "s"} and ${consensusPending} consensus review${consensusPending === 1 ? "" : "s"} pending.`, href: "/admin/results", metrics: [{ label: "Ranked", value: results.summary.rankedSubmissions }, { label: "Unranked", value: results.summary.incompleteSubmissions }, { label: "Ties", value: pendingTies }, { label: "Consensus", value: consensusPending }] },
    { id: "publication", label: "Publication", state: publicationPublished ? "healthy" : publicationReady ? "ready" : publicationBlockers > 0 ? "attention" : "healthy", headline: publicationPublished ? "Results are public" : publicationReady ? "Ready to publish" : `Private · ${publication.release.status}`, explanation: publicationPublished ? "The current publication release is public; use the publication tool for controlled recovery." : publicationReady ? "All required result review signals are complete and the release remains private." : "Results remain private while publication content and review are prepared.", href: "/admin/publication", metrics: [{ label: "Finalists", value: publication.summary.finalists }, { label: "Awards", value: publication.summary.awards }, { label: "Feedback", value: publication.summary.feedbackReleased }, { label: "Status", value: publication.release.status }] },
  ];
  const summary = { total: deduped.length, blockers: deduped.filter((item) => item.severity === "blocker").length, actions: deduped.filter((item) => item.severity === "action").length, watch: deduped.filter((item) => item.severity === "watch").length, mostImportant: deduped[0] ?? null };
  return { event: { id: event.id, name: event.name, phase, phaseLabel: phaseLabel(phase, publication.release.status), isFrozen: event.isFrozen }, overall: { state: overall.state, label: overall.state === "attention" ? "Attention needed" : overall.state[0].toUpperCase() + overall.state.slice(1), summary: overall.summary }, domains, attention: { items: deduped, summary } };
}
