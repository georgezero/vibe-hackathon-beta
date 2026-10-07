/**
 * One informational completion signal shared by Account, the editor, and
 * participant workspace surfaces. It never participates in authorization,
 * eligibility, judging, or publication decisions.
 */
export type ProfileCompletenessInput = {
  displayName?: string | null;
  handle?: string | null;
  headline?: string | null;
  affiliation?: string | null;
  bio?: string | null;
  websiteUrl?: string | null;
  githubUrl?: string | null;
  linkedinUrl?: string | null;
  interests?: readonly string[] | null;
};

export type ProfileCompleteness = {
  completed: number;
  total: 6;
  label: string;
};

export function calculateProfileCompleteness(profile: ProfileCompletenessInput): ProfileCompleteness {
  const completed = [
    Boolean(profile.displayName),
    Boolean(profile.handle),
    Boolean(profile.headline),
    Boolean(profile.affiliation),
    Boolean(profile.bio),
    Boolean(profile.websiteUrl || profile.githubUrl || profile.linkedinUrl || profile.interests?.length),
  ].filter(Boolean).length;
  return { completed, total: 6, label: `${completed} of 6 recommended details added` };
}
