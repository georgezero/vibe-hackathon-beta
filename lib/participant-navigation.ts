/**
 * Small, server-safe navigation decisions shared by NavPublic and tests.
 *
 * Navigation is presentation only: these values never authorize a mutation.
 * Deadline and publication authority remain in the existing submission and
 * publication domain operations.
 */
export type ParticipantNavigationState = {
  submissionsOpen: boolean;
  resultsPublished: boolean;
};

export function participantNavigationState(input: {
  isFrozen?: boolean | null;
  submissionDeadline?: Date | null;
  publicationStatus?: string | null;
  now?: Date;
}): ParticipantNavigationState {
  const now = input.now?.getTime() ?? Date.now();
  const submissionsOpen = !input.isFrozen && (!input.submissionDeadline || input.submissionDeadline.getTime() > now);
  const resultsPublished = input.publicationStatus === "published" || input.publicationStatus === "archived";
  return { submissionsOpen, resultsPublished };
}

export function boundedUnreadCount(count: number | null | undefined): number {
  return Math.max(0, Number.isFinite(count) ? Math.floor(count as number) : 0);
}
