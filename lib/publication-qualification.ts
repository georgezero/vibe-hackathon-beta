const SUBMISSION_ID_PATTERN = /^sub_[A-Za-z0-9_-]+$/;

export type PublicationQualificationConfig = {
  enabled: boolean;
  allowlist: string[];
  valid: boolean;
};

/** Server-only, fail-closed qualification configuration. */
export function getPublicationQualificationConfig(): PublicationQualificationConfig {
  const enabled = process.env.VIBE_PUBLICATION_QUALIFICATION_ENABLED === "true";
  const raw = process.env.VIBE_PUBLICATION_QUALIFICATION_SUBMISSION_ALLOWLIST?.trim() ?? "";
  if (!raw) return { enabled, allowlist: [], valid: raw === "" };
  const parts = raw.split(",").map((value) => value.trim());
  const values = [...new Set(parts.filter(Boolean))];
  const valid = values.length > 0 && parts.every(Boolean) && values.every((value) => SUBMISSION_ID_PATTERN.test(value));
  return { enabled, allowlist: valid ? values : [], valid };
}

export function isPublicationQualificationSubmission(submissionId: string) {
  const config = getPublicationQualificationConfig();
  return config.enabled && config.valid && config.allowlist.includes(submissionId);
}

export function isPublicationQualificationEnabled() {
  return getPublicationQualificationConfig().enabled;
}
