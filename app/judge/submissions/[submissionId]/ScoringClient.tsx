"use client";

import { type KeyboardEvent, useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShortcutHelpOverlay } from "@/components/ShortcutHelpOverlay";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";

const RUBRIC_CATEGORIES = [
  { key: "problemSelection", label: "Problem Selection", desc: "Is this the right problem to solve? Is it impactful?" },
  { key: "productUsefulness", label: "Product Usefulness", desc: "Would real users pay for or rely on this?" },
  { key: "functionality", label: "Functionality & Reliability", desc: "Does it reliably do what it claims? Were you able to test it?" },
  { key: "uxDesign", label: "UX & Design", desc: "Is the experience polished, clear, and usable?" },
  { key: "aiCollaboration", label: "AI Collaboration Strategy", desc: "How effectively did the team direct AI agents? Is the prompt strategy thoughtful?" },
  { key: "originality", label: "Originality & Creativity", desc: "Is the approach novel? Does it stand out?" },
  { key: "maintainability", label: "Technical Maintainability", desc: "Is the codebase clean, documented, and reproducible?" },
  { key: "presentationClarity", label: "Presentation Clarity", desc: "Is the submission clear, complete, and well-communicated?" },
] as const;

type RubricKey = typeof RUBRIC_CATEGORIES[number]["key"];

interface TeamMember {
  name: string;
  role: string;
}

interface SubType {
  id: string;
  projectTitle: string | null;
  teamName: string;
  demoUrl: string | null;
  githubUrl: string | null;
  screenshotUrl: string | null;
  members: TeamMember[];
}

interface ScoreType {
  problemSelection: number | null;
  productUsefulness: number | null;
  functionality: number | null;
  uxDesign: number | null;
  aiCollaboration: number | null;
  originality: number | null;
  maintainability: number | null;
  presentationClarity: number | null;
  privateNotes: string | null;
  recommendation: string | null;
  completed: boolean | number | null;
}

interface Props {
  sub: SubType;
  existingScore: ScoreType | null;
  submissionIds: string[];
  embedded?: boolean;
}

interface SavedSnapshot {
  scores: Record<RubricKey, number>;
  notes: string;
  recommendation: string;
}

export default function ScoringClient({ sub, existingScore, submissionIds, embedded = false }: Props) {
  const router = useRouter();
  const initialScores = useMemo<Record<RubricKey, number>>(() => ({
    problemSelection: existingScore?.problemSelection ?? 5,
    productUsefulness: existingScore?.productUsefulness ?? 5,
    functionality: existingScore?.functionality ?? 5,
    uxDesign: existingScore?.uxDesign ?? 5,
    aiCollaboration: existingScore?.aiCollaboration ?? 5,
    originality: existingScore?.originality ?? 5,
    maintainability: existingScore?.maintainability ?? 5,
    presentationClarity: existingScore?.presentationClarity ?? 5,
  }), [existingScore]);

  const [scores, setScores] = useState<Record<RubricKey, number>>({
    ...initialScores,
  });

  const [notes, setNotes] = useState(existingScore?.privateNotes ?? "");
  const [recommendation, setRecommendation] = useState<string>(existingScore?.recommendation ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [pendingNavigationId, setPendingNavigationId] = useState<string | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState<SavedSnapshot>({
    scores: initialScores,
    notes: existingScore?.privateNotes ?? "",
    recommendation: existingScore?.recommendation ?? "",
  });

  const totalScores = Object.values(scores);
  const avgScore = Math.round((totalScores.reduce((a, b) => a + b, 0) / totalScores.length) * 10) / 10;

  function setScore(key: RubricKey, val: number) {
    setSaved(false);
    setScores((prev) => ({ ...prev, [key]: val }));
  }

  const isDirty = useMemo(() => {
    if (notes !== savedSnapshot.notes || recommendation !== savedSnapshot.recommendation) return true;
    return RUBRIC_CATEGORIES.some((cat) => scores[cat.key] !== savedSnapshot.scores[cat.key]);
  }, [notes, recommendation, savedSnapshot, scores]);

  async function handleSave() {
    setSaving(true);
    try {
      const response = await fetch("/api/scores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId: sub.id,
          scores,
          notes,
          recommendation,
          completed: false,
        }),
      });
      if (!response.ok) return false;
      setSaved(true);
      setSavedSnapshot({ scores: { ...scores }, notes, recommendation });
      return true;
    } finally {
      setSaving(false);
    }
  }

  async function handleComplete() {
    setCompleting(true);
    try {
      const response = await fetch("/api/scores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId: sub.id,
          scores,
          notes,
          recommendation,
          completed: true,
        }),
      });
      if (response.ok) {
        setSaved(true);
        setSavedSnapshot({ scores: { ...scores }, notes, recommendation });
      }
    } finally {
      setCompleting(false);
    }
  }

  const navigateToSubmission = useCallback((submissionId: string) => {
    router.push(embedded ? `/judge/projects/${submissionId}/evaluation` : `/judge/submissions/${submissionId}`);
  }, [embedded, router]);

  const requestNavigation = useCallback((direction: 1 | -1) => {
    if (submissionIds.length === 0) return;
    const currentIndex = submissionIds.indexOf(sub.id);
    if (currentIndex < 0) return;
    const nextIndex = (currentIndex + direction + submissionIds.length) % submissionIds.length;
    const nextSubmissionId = submissionIds[nextIndex];
    if (!nextSubmissionId || nextSubmissionId === sub.id) return;
    if (isDirty) {
      setPendingNavigationId(nextSubmissionId);
      return;
    }
    navigateToSubmission(nextSubmissionId);
  }, [isDirty, navigateToSubmission, sub.id, submissionIds]);

  async function saveAndContinue() {
    if (!pendingNavigationId) return;
    const nextId = pendingNavigationId;
    const ok = await handleSave();
    if (ok) {
      setPendingNavigationId(null);
      navigateToSubmission(nextId);
    }
  }

  function discardAndContinue() {
    if (!pendingNavigationId) return;
    const nextId = pendingNavigationId;
    setPendingNavigationId(null);
    navigateToSubmission(nextId);
  }

  const focusRubricField = useCallback((direction: 1 | -1) => {
    const fields = Array.from(document.querySelectorAll<HTMLInputElement>("[data-rubric-score-field]"));
    if (fields.length === 0) return;
    const activeIndex = fields.findIndex((field) => field === document.activeElement);
    const nextIndex = activeIndex < 0
      ? direction === 1 ? 0 : fields.length - 1
      : (activeIndex + direction + fields.length) % fields.length;
    fields[nextIndex]?.focus();
    fields[nextIndex]?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, []);

  useKeyboardShortcuts(useCallback((event) => {
    if (event.key === "?") {
      event.preventDefault();
      setShowHelp((value) => !value);
      return;
    }
    if (event.key === "Escape") {
      setShowHelp(false);
      setPendingNavigationId(null);
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      if (!completing && recommendation) void handleComplete();
      return;
    }
    if (event.metaKey || event.ctrlKey) return;
    if (event.key === "j") {
      event.preventDefault();
      focusRubricField(1);
      return;
    }
    if (event.key === "k") {
      event.preventDefault();
      focusRubricField(-1);
      return;
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      requestNavigation(1);
      return;
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      requestNavigation(-1);
      return;
    }
    if (event.key === "p") {
      event.preventDefault();
      router.push("/judge/dashboard");
    }
  }, [completing, focusRubricField, recommendation, requestNavigation, router]), true, { allowModified: true });

  function handleScoreKeyDown(event: KeyboardEvent<HTMLInputElement>, key: RubricKey) {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key === "j") {
      event.preventDefault();
      focusRubricField(1);
      return;
    }
    if (event.key === "k") {
      event.preventDefault();
      focusRubricField(-1);
      return;
    }
    if (/^[1-9]$/.test(event.key)) {
      event.preventDefault();
      setScore(key, Number(event.key));
      return;
    }
    if (event.key === "0") {
      event.preventDefault();
      setScore(key, 10);
    }
  }

  const recOptions: { value: string; label: string; color: string }[] = [
    { value: "strong-yes", label: "Strong Yes", color: "var(--color-success)" },
    { value: "yes", label: "Yes", color: "var(--color-success)" },
    { value: "maybe", label: "Maybe", color: "var(--color-warning)" },
    { value: "no", label: "No", color: "var(--color-error)" },
  ];

  return (
    <div className="mx-auto max-w-4xl w-full px-4 sm:px-6 py-10 flex-1">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-6" style={{ fontSize: "0.8125rem", color: "var(--color-subtle)" }}>
          <Link href={embedded ? `/judge/projects/${sub.id}` : "/judge/dashboard"} style={{ color: "var(--color-muted)", textDecoration: "none" }}>
            {embedded ? "Project workspace" : "My assignments"}
          </Link>
          <span>/</span>
          <span>{sub.projectTitle}</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Scoring form */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                {existingScore?.completed && <span className="badge badge-success">Reviewed</span>}
                {saved && <span className="badge badge-success">Saved</span>}
              </div>
              <h1 style={{ fontFamily: "var(--font-headline)", fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.03em", color: "var(--color-fg)", marginBottom: "0.25rem" }}>
                {sub.projectTitle}
              </h1>
              <p style={{ color: "var(--color-muted)", fontSize: "0.875rem" }}>
                {sub.teamName} · {sub.members.map((m) => m.name).join(", ")}
              </p>
            </div>

            {/* Rubric */}
            <div className="flex flex-col gap-4">
              {RUBRIC_CATEGORIES.map((cat) => (
                <div key={cat.key} className="card" style={{ padding: "1rem" }}>
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <div style={{ fontWeight: 600, color: "var(--color-fg)", fontSize: "0.9rem" }}>{cat.label}</div>
                      <div style={{ fontSize: "0.75rem", color: "var(--color-muted)", marginTop: "0.25rem" }}>{cat.desc}</div>
                    </div>
                    <div
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "1.25rem",
                        fontWeight: 700,
                        color: "var(--color-accent)",
                        minWidth: "2rem",
                        textAlign: "right",
                      }}
                    >
                      {scores[cat.key as RubricKey]}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <span style={{ fontSize: "0.6875rem", color: "var(--color-subtle)", width: "2rem" }}>1</span>
                    <input
                      type="range"
                      min={1}
                      max={10}
                      value={scores[cat.key as RubricKey]}
                      onChange={(e) => setScore(cat.key as RubricKey, Number(e.target.value))}
                      onKeyDown={(e) => handleScoreKeyDown(e, cat.key as RubricKey)}
                      aria-label={`${cat.label} score`}
                      data-rubric-score-field={cat.key}
                      style={{ flex: 1, accentColor: "var(--color-accent)" }}
                    />
                    <span style={{ fontSize: "0.6875rem", color: "var(--color-subtle)", width: "2rem", textAlign: "right" }}>10</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Private notes */}
            <div>
              <label className="label">Private notes (only visible to you)</label>
              <textarea
                className="textarea"
                style={{ minHeight: "6rem" }}
                value={notes}
                onChange={(e) => { setNotes(e.target.value); setSaved(false); }}
                placeholder="Keep a private note about this project for your own evaluation record…"
              />
            </div>

            {/* Recommendation */}
            <div>
              <label className="label">Final recommendation</label>
              <div className="flex gap-2 flex-wrap">
                {recOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => { setRecommendation(opt.value); setSaved(false); }}
                    style={{
                      borderRadius: 8,
                      padding: "0.5rem 1rem",
                      fontSize: "0.875rem",
                      fontWeight: 500,
                      border: `1px solid ${recommendation === opt.value ? opt.color : "var(--color-border)"}`,
                      background: recommendation === opt.value ? `color-mix(in srgb, ${opt.color} 14%, transparent)` : "transparent",
                      color: recommendation === opt.value ? opt.color : "var(--color-muted)",
                      cursor: "pointer",
                      transition: "all 140ms",
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Save / Complete */}
            <div className="flex items-center gap-3 pt-4 border-t" style={{ borderColor: "var(--color-border)" }}>
              <button onClick={handleSave} disabled={saving} className="btn-secondary">
                {saving ? "Saving…" : "Save progress"}
              </button>
              <button
                onClick={handleComplete}
                disabled={completing || !recommendation}
                className="btn-primary"
              >
                {completing ? "Completing…" : "Mark review complete ✓"}
              </button>
              {!recommendation && (
                <span style={{ fontSize: "0.75rem", color: "var(--color-subtle)" }}>
                  Select a recommendation first
                </span>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="flex flex-col gap-4">
            {/* Screenshot */}
            {sub.screenshotUrl && (
              <div className="card overflow-hidden" style={{ padding: 0 }}>
                <a href={sub.demoUrl ?? "#"} target="_blank" rel="noopener noreferrer">
                  <img
                    src={sub.screenshotUrl}
                    alt={sub.projectTitle ?? "Project screenshot"}
                    style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover", display: "block" }}
                  />
                </a>
              </div>
            )}

            {/* Live score */}
            <div className="card text-center" style={{ padding: "1.5rem" }}>
              <div style={{ fontSize: "0.6875rem", color: "var(--color-subtle)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.75rem" }}>
                Your average score
              </div>
              <div style={{ fontFamily: "var(--font-headline)", fontSize: "3rem", fontWeight: 800, color: "var(--color-accent)", lineHeight: 1 }}>
                {avgScore}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--color-subtle)", marginTop: "0.375rem" }}>out of 10</div>
            </div>

            {/* Score breakdown */}
            <div className="card" style={{ padding: "1.125rem" }}>
              <div style={{ fontWeight: 600, color: "var(--color-fg)", fontSize: "0.875rem", marginBottom: "0.875rem" }}>Score breakdown</div>
              <div className="flex flex-col gap-2">
                {RUBRIC_CATEGORIES.map((cat) => (
                  <div key={cat.key} className="flex items-center justify-between gap-2">
                    <span style={{ fontSize: "0.75rem", color: "var(--color-muted)", flex: 1 }}>{cat.label}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <div style={{ width: 48, height: 3, background: "var(--color-surface-2)", borderRadius: 999, overflow: "hidden" }}>
                        <div style={{ width: `${scores[cat.key as RubricKey] * 10}%`, height: "100%", background: "var(--color-accent)", borderRadius: 999 }} />
                      </div>
                      <span style={{ fontSize: "0.75rem", fontFamily: "var(--font-mono)", color: "var(--color-fg)", minWidth: "1.25rem", textAlign: "right" }}>
                        {scores[cat.key as RubricKey]}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick links */}
            <div className="card" style={{ padding: "1.125rem" }}>
              <div style={{ fontWeight: 600, color: "var(--color-fg)", fontSize: "0.875rem", marginBottom: "0.75rem" }}>Submission links</div>
              <div className="flex flex-col gap-1.5">
                <a href={sub.demoUrl ?? "#"} target="_blank" rel="noopener noreferrer" className="btn-ghost" style={{ fontSize: "0.8125rem", padding: "0.25rem 0.5rem", justifyContent: "space-between" }}>
                  <span>Live demo</span><span>↗</span>
                </a>
                <a href={sub.githubUrl ?? "#"} target="_blank" rel="noopener noreferrer" className="btn-ghost" style={{ fontSize: "0.8125rem", padding: "0.25rem 0.5rem", justifyContent: "space-between" }}>
                  <span>GitHub repo</span><span>↗</span>
                </a>
                <Link href={`/judge/submissions/${sub.id}/ai`} className="btn-ghost" style={{ fontSize: "0.8125rem", padding: "0.25rem 0.5rem", justifyContent: "space-between" }}>
                  <span>AI review</span><span>→</span>
                </Link>
              </div>
            </div>

            <Link href="/judge/dashboard" className="btn-ghost" style={{ justifyContent: "center" }}>
              ← All assignments
            </Link>
          </div>
        </div>
        <ShortcutHelpOverlay open={showHelp} onClose={() => setShowHelp(false)} showJudging />
        {pendingNavigationId && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Unsaved changes"
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 1300,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "1rem",
            }}
          >
            <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.62)", backdropFilter: "blur(5px)" }} />
            <div className="card" style={{ position: "relative", width: "100%", maxWidth: 440, padding: "1.5rem" }}>
              <div className="badge badge-warning" style={{ marginBottom: "0.75rem" }}>Unsaved changes</div>
              <h2 style={{ fontFamily: "var(--font-headline)", color: "var(--color-fg)", fontSize: "1.375rem", fontWeight: 800, letterSpacing: "-0.03em", marginBottom: "0.5rem" }}>
                Continue to another submission?
              </h2>
              <p style={{ color: "var(--color-muted)", fontSize: "0.875rem", marginBottom: "1.25rem" }}>
                This scorecard has unsaved edits. Save progress before continuing, discard the changes, or cancel navigation.
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <button type="button" onClick={saveAndContinue} disabled={saving} className="btn-primary">
                  {saving ? "Saving..." : "Save & Continue"}
                </button>
                <button type="button" onClick={discardAndContinue} className="btn-secondary">
                  Discard Changes
                </button>
                <button type="button" onClick={() => setPendingNavigationId(null)} className="btn-ghost">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
  );
}
