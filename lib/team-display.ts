import type { InferSelectModel } from "drizzle-orm";
import { teamMembers } from "@/lib/db/schema";
import { computePrizeEligibility } from "@/lib/prize-eligibility";

type TeamMember = InferSelectModel<typeof teamMembers>;

export interface PublicTeamMember {
  name: string;
  role: "Team Lead" | "Teammate";
  affiliation: string | null;
  degrees: string | null;
  isStudentTrainee: boolean;
}

export interface AdminTeamMember extends PublicTeamMember {
  email: string | null;
  badgeNumber: string | null;
  badgeVerificationStatus: string;
}

export interface AdminTeamRoster {
  submissionId: string;
  teamName: string;
  projectTitle: string | null;
  ownershipType: "github" | "badge";
  ownerGithubLogin: string | null;
  teamSize: number;
  badgeCount: number;
  prizeEligible: boolean;
  studentTraineeCount: number;
  members: AdminTeamMember[];
}

function orderedMembers(members: TeamMember[]): TeamMember[] {
  return [...members].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}

export function toPublicTeamMembers(members: TeamMember[]): PublicTeamMember[] {
  return orderedMembers(members).map((member) => ({
    name: member.name,
    role: member.order === 0 ? "Team Lead" : "Teammate",
    affiliation: member.affiliation,
    degrees: member.degrees,
    isStudentTrainee: Boolean(member.isStudentTrainee),
  }));
}

export function toAdminTeamMembers(members: TeamMember[]): AdminTeamMember[] {
  return orderedMembers(members).map((member) => ({
    name: member.name,
    role: member.order === 0 ? "Team Lead" : "Teammate",
    email: member.email,
    badgeNumber: member.badgeNumber,
    affiliation: member.affiliation,
    degrees: member.degrees,
    isStudentTrainee: Boolean(member.isStudentTrainee),
    badgeVerificationStatus: member.badgeVerificationStatus,
  }));
}

export function rosterSummary(members: TeamMember[]) {
  return computePrizeEligibility(members.map((member) => ({
    name: member.name,
    badgeNumber: member.badgeNumber,
    isStudentTrainee: member.isStudentTrainee,
  })));
}
