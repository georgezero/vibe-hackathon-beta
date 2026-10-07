export interface JudgeApiPolicy {
  access: "authenticated-judge";
  mutation: boolean;
}

export const JUDGE_API_POLICIES = {
  "GET /api/judge/data": {
    access: "authenticated-judge",
    mutation: false,
  },
  "POST /api/scores": {
    access: "authenticated-judge",
    mutation: true,
  },
} as const satisfies Record<string, JudgeApiPolicy>;

export type JudgeApiPolicyKey = keyof typeof JUDGE_API_POLICIES;
