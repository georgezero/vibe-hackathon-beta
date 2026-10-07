import { describe, expect, it } from "vitest";
import { assignmentInspectorHref, deduplicateAttentionItems, evaluateEventHealth, type AttentionItem } from "@/lib/event-health";

const base = {
  phase: "judging_closed",
  submissions: { incomplete: 0, ownershipProblems: 0, notReadyForJudging: 0 },
  judging: { coverageBlocked: 0, replacementRequired: 0, staleDrafts: 0, missingEvaluations: 0 },
  results: { incomplete: 0, pendingTies: 0, highVariance: 0, consensusPending: 0 },
  publication: { blockers: 0, ready: false, published: false },
};

describe("event health rules", () => {
  it("blocks when judging coverage is impossible", () => {
    expect(evaluateEventHealth({ ...base, judging: { ...base.judging, coverageBlocked: 1 } }).state).toBe("blocked");
  });

  it("treats recusal/replacement work as attention when coverage remains possible", () => {
    expect(evaluateEventHealth({ ...base, judging: { ...base.judging, replacementRequired: 1 } }).state).toBe("attention");
  });

  it("blocks incomplete results after judging closes", () => {
    expect(evaluateEventHealth({ ...base, results: { ...base.results, incomplete: 2 } }).state).toBe("blocked");
  });

  it("surfaces ties, variance, and consensus as advisory attention", () => {
    expect(evaluateEventHealth({ ...base, results: { ...base.results, pendingTies: 1, highVariance: 2, consensusPending: 1 } }).state).toBe("attention");
  });

  it("distinguishes ready-to-publish from healthy and keeps publication private", () => {
    expect(evaluateEventHealth({ ...base, publication: { blockers: 0, ready: true, published: false } }).state).toBe("ready");
  });

  it("deduplicates one root cause and keeps severity ordering", () => {
    const item = (id: string, severity: AttentionItem["severity"]): AttentionItem => ({ id, severity, category: "judging", title: id, explanation: "x", affected: "x", why: "x", recommendation: "x", href: "/admin/judging", createdAt: null });
    const items = deduplicateAttentionItems([item("coverage:sub-1:missing", "blocker"), item("coverage:sub-1:tie", "action"), item("results:sub-2:tie", "action"), item("variance:sub-3:watch", "watch")]);
    expect(items.map((entry) => entry.id)).toEqual(["coverage:sub-1:missing", "results:sub-2:tie", "variance:sub-3:watch"]);
  });

  it("targets the exact conflicted assignment in remediation links", () => {
    expect(assignmentInspectorHref("kv_assignment_0053")).toBe("/admin/judging?assignment=kv_assignment_0053");
  });
});
