import { getBaseUrl } from "@/lib/base-url";

export function submissionLinks(editToken: string, submissionId?: string | null) {
  const baseUrl = getBaseUrl();
  return {
    submission_id: submissionId ?? null,
    start_url: `${baseUrl}/submit/${editToken}/start`,
    edit_url: `${baseUrl}/submit/${editToken}`,
    preview_url: `${baseUrl}/submit/${editToken}/preview`,
    finalize_url: submissionId ? `${baseUrl}/api/v1/submissions/${submissionId}/finalize` : null,
  };
}
