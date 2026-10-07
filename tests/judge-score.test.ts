import { describe, expect, it } from "vitest";
import { parseJudgeScorePayload } from "@/lib/judge-score";

const completeScores = {
  problemSelection: 8,
  productUsefulness: 8,
  functionality: 8,
  uxDesign: 8,
  aiCollaboration: 8,
  originality: 8,
  maintainability: 8,
  presentationClarity: 8,
};

describe("judge score payload", () => {
  it("preserves valid draft and completed scoring semantics", () => {
    expect(parseJudgeScorePayload({
      submissionId: "submission-a",
      scores: { problemSelection: 7 },
      recommendation: "",
      completed: false,
    })).toMatchObject({
      ok: true,
      value: {
        submissionId: "submission-a",
        scores: { problemSelection: 7, productUsefulness: null },
        recommendation: null,
        completed: false,
      },
    });

    expect(parseJudgeScorePayload({
      submissionId: "submission-a",
      scores: completeScores,
      recommendation: "strong-yes",
      notes: "Private note",
      completed: true,
    })).toMatchObject({
      ok: true,
      value: {
        recommendation: "strong-yes",
        completed: true,
      },
    });
  });

  it.each([0, 11, 1.5, "8", Number.NaN])(
    "rejects an invalid rubric value %s",
    (value) => {
      expect(parseJudgeScorePayload({
        submissionId: "submission-a",
        scores: { problemSelection: value },
      })).toEqual({
        ok: false,
        error: "Every rubric score must be an integer from 1 to 10.",
      });
    },
  );

  it("rejects invalid recommendation, notes, and completed types", () => {
    expect(parseJudgeScorePayload({
      submissionId: "submission-a",
      recommendation: "override",
    }).ok).toBe(false);
    expect(parseJudgeScorePayload({
      submissionId: "submission-a",
      notes: { private: true },
    }).ok).toBe(false);
    expect(parseJudgeScorePayload({
      submissionId: "submission-a",
      completed: "true",
    }).ok).toBe(false);
  });

  it("requires all rubric values and a recommendation before completion", () => {
    expect(parseJudgeScorePayload({
      submissionId: "submission-a",
      scores: { problemSelection: 8 },
      completed: true,
    })).toEqual({
      ok: false,
      error: "Completed scorecards require every rubric score and a recommendation.",
    });
  });
});
