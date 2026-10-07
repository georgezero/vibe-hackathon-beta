export interface PrizeMember {
  name: string;
  badgeNumber?: string | null;
  isStudentTrainee?: boolean | null;
}

export interface PrizeEligibilitySummary {
  memberCount: number;
  badgeCount: number;
  missingBadgeCount: number;
  studentTraineeCount: number;
  eligibleForPrize: boolean;
  missingMembers: string[];
}

export function computePrizeEligibility(members: PrizeMember[]): PrizeEligibilitySummary {
  const normalized = members.filter((member) => member.name.trim());
  const missingMembers = normalized
    .filter((member) => !member.badgeNumber?.trim())
    .map((member) => member.name);
  const badgeCount = normalized.length - missingMembers.length;

  return {
    memberCount: normalized.length,
    badgeCount,
    missingBadgeCount: missingMembers.length,
    studentTraineeCount: normalized.filter((member) => Boolean(member.isStudentTrainee)).length,
    eligibleForPrize: normalized.length > 0 && missingMembers.length === 0,
    missingMembers,
  };
}
