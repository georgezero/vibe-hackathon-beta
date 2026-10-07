/**
 * Submission status is intentionally small and historical rows use more than
 * one spelling. Keep participant-facing finalization decisions in one place.
 */
export function isSubmittedStatus(status: string | null | undefined) {
  return status === "submitted" || status === "finalized" || status === "locked";
}

export function isHardLockedStatus(status: string | null | undefined) {
  return status === "locked";
}

export function participantSubmissionState(status: string | null | undefined) {
  if (isHardLockedStatus(status)) {
    return {
      label: "Changes closed",
      explanation: "This project is no longer accepting participant changes.",
      canEditBeforeDeadline: false,
    } as const;
  }
  if (isSubmittedStatus(status)) {
    return {
      label: "Submitted for judging",
      explanation: "You can update and submit a new version before the event deadline.",
      canEditBeforeDeadline: true,
    } as const;
  }
  return {
    label: "Draft",
    explanation: "Keep adding project details before you submit.",
    canEditBeforeDeadline: true,
  } as const;
}
