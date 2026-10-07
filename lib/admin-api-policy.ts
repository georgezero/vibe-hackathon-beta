export type AdminApiAccess =
  | "authenticated-admin"
  | "development-only"
  | "intentionally-public";

export interface AdminApiPolicy {
  access: AdminApiAccess;
  mutation: boolean;
  justification?: string;
}

export const ADMIN_API_POLICIES = {
  "GET /api/admin/event-health": {
    access: "authenticated-admin",
    mutation: false,
  },
  "GET /api/admin/participant-experience": {
    access: "authenticated-admin",
    mutation: false,
  },
  "PATCH /api/admin/participant-experience/feedback/[feedbackId]": {
    access: "authenticated-admin",
    mutation: true,
  },
  "GET /api/admin/community/channels": {
    access: "authenticated-admin",
    mutation: false,
  },
  "GET /api/admin/community/reports": {
    access: "authenticated-admin",
    mutation: false,
  },
  "POST /api/admin/community/channels": {
    access: "authenticated-admin",
    mutation: true,
  },
  "PATCH /api/admin/community/channels": {
    access: "authenticated-admin",
    mutation: true,
  },
  "POST /api/admin/community/messages/[messageId]": {
    access: "authenticated-admin",
    mutation: true,
  },
  "GET /api/admin/events": {
    access: "authenticated-admin",
    mutation: false,
  },
  "POST /api/admin/events": {
    access: "authenticated-admin",
    mutation: true,
  },
  "PATCH /api/admin/events": {
    access: "authenticated-admin",
    mutation: true,
  },
  "GET /api/admin/export/[dataset]": {
    access: "authenticated-admin",
    mutation: false,
  },
  "GET /api/admin/ai-runs": {
    access: "authenticated-admin",
    mutation: false,
  },
  "POST /api/admin/ai-runs": {
    access: "authenticated-admin",
    mutation: true,
  },
  "GET /api/admin/ai-runs/[id]": {
    access: "authenticated-admin",
    mutation: false,
  },
  "POST /api/admin/ai-runs/batch": {
    access: "authenticated-admin",
    mutation: true,
  },
  "POST /api/admin/ai-runs/import": {
    access: "authenticated-admin",
    mutation: true,
  },
  "GET /api/admin/ai-runs/packet/[submissionId]": {
    access: "authenticated-admin",
    mutation: false,
  },
  "GET /api/admin/ai-runs/prompt/[submissionId]": {
    access: "authenticated-admin",
    mutation: false,
  },
  "POST /api/admin/ai-runs/token/[submissionId]": {
    access: "authenticated-admin",
    mutation: true,
  },
  "POST /api/admin/people": {
    access: "authenticated-admin",
    mutation: true,
  },
  "PATCH /api/admin/people/[userId]": {
    access: "authenticated-admin",
    mutation: true,
  },
  "POST /api/admin/people/[userId]": {
    access: "authenticated-admin",
    mutation: true,
  },
  "PATCH /api/admin/invitations/[invitationId]": {
    access: "authenticated-admin",
    mutation: true,
  },
  "POST /api/admin/judging": {
    access: "authenticated-admin",
    mutation: true,
  },
  "POST /api/admin/results": {
    access: "authenticated-admin",
    mutation: true,
  },
  "POST /api/admin/calibration": {
    access: "authenticated-admin",
    mutation: true,
  },
  "POST /api/admin/publication": {
    access: "authenticated-admin",
    mutation: true,
  },
  "GET /api/admin/publication/export": {
    access: "authenticated-admin",
    mutation: false,
  },
  "GET /api/admin/results/export": {
    access: "authenticated-admin",
    mutation: false,
  },
  "POST /api/admin/seed": {
    access: "development-only",
    mutation: true,
    justification: "Destructive demo-data reset is available only in an explicit development runtime.",
  },
} as const satisfies Record<string, AdminApiPolicy>;

export type AdminApiPolicyKey = keyof typeof ADMIN_API_POLICIES;
