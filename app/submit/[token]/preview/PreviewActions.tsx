"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  submissionId: string;
  token: string;
  editUrl: string;
  previewUrl: string;
  canFinalize: boolean;
  isSubmitted: boolean;
  missingFields: string[];
  weakFields: string[];
}

export function PreviewActions({ submissionId, token, editUrl, previewUrl, canFinalize, isSubmitted, missingFields, weakFields }: Props) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [error, setError] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);
  const confirmationHeadingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (confirming) confirmationHeadingRef.current?.focus();
  }, [confirming]);

  const revisionPrompt = useMemo(() => {
    return `Update the Vibe Hackathon draft submission.

Submission ID: ${submissionId}
Edit token: ${token}
Edit URL: ${editUrl}
Preview URL: ${previewUrl}

Missing fields:
${missingFields.length ? missingFields.map((field) => `- ${field}`).join("\n") : "- None"}

Weak fields:
${weakFields.length ? weakFields.map((field) => `- ${field}`).join("\n") : "- None"}

Instructions:
- Update the draft submission using the edit token.
- Improve missing and weak fields.
- Update team details only when the human provides them: teammate names, emails, badge numbers, affiliations/institutions, degrees, and student/trainee status.
- Preserve accurate project facts.
- Do not invent evidence.
- Do not invent teammate information; leave unknown team fields blank.
- Do not finalize unless I explicitly ask.`;
  }, [editUrl, missingFields, previewUrl, submissionId, token, weakFields]);

  async function copyPrompt() {
    await navigator.clipboard.writeText(revisionPrompt);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  async function finalize() {
    setFinalizing(true);
    setError("");
    const requestKey = idempotencyKey ?? crypto.randomUUID();
    setIdempotencyKey(requestKey);
    try {
      const res = await fetch(`/api/v1/submissions/${submissionId}/finalize`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "Idempotency-Key": requestKey,
        },
        body: JSON.stringify({ source: "preview" }),
      });
      if (res.ok) {
        router.push(`/submit/${token}/done`);
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (data.code === "DEADLINE_PASSED") {
        setError("Submissions are closed. Your project is safe; you can still review it here.");
      } else if (data.code === "READINESS_INCOMPLETE") {
        const labels = Array.isArray(data.missingItems) ? data.missingItems.map((item: { label?: string }) => item.label).filter(Boolean) : [];
        setError(labels.length ? `Add ${labels.join(", ")} before submitting.` : "Complete the required project details before submitting.");
      } else {
        setError(data.error ?? "The project could not be submitted. Review the readiness items and try again.");
      }
    } catch {
      setError("We could not submit the project right now. Your draft is safe; try again.");
    } finally {
      setFinalizing(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <button type="button" onClick={copyPrompt} className="btn-secondary" style={{ justifyContent: "center" }}>
        {copied ? "Copied revision prompt" : "Copy Revision Prompt"}
      </button>
      {canFinalize && !confirming && (
        <button type="button" onClick={() => setConfirming(true)} className="btn-primary" style={{ justifyContent: "center" }}>
        {isSubmitted ? "Submit updated version" : "Submit for judging"}
        </button>
      )}
      {canFinalize && confirming && (
        <div className="card" role="dialog" aria-modal="true" aria-labelledby="submission-confirmation-title" aria-describedby="submission-confirmation-copy" style={{ padding: "1rem", borderColor: "var(--color-warning)" }}>
          <h2 id="submission-confirmation-title" ref={confirmationHeadingRef} tabIndex={-1} style={{ color: "var(--color-fg)", fontWeight: 850, fontSize: "1.05rem", marginBottom: "0.55rem", outline: "none" }}>
            {isSubmitted ? "Submit this updated version?" : "Submit this project for judging?"}
          </h2>
          <p id="submission-confirmation-copy" style={{ color: "var(--color-muted)", fontSize: "0.8125rem", lineHeight: 1.55, marginBottom: "0.75rem" }}>
            {isSubmitted
              ? "This submits the updated project version for judging. You can update and submit again while the event deadline remains open."
              : "This marks the current project version for judging. You can update and submit again while the event deadline remains open."} Review the project details and team first. Agents should only do this when explicitly instructed by the human team lead.
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={finalize} disabled={finalizing} className="btn-primary" style={{ flex: 1, justifyContent: "center" }}>
              {finalizing ? "Submitting…" : isSubmitted ? "Submit updated version" : "Submit for judging"}
            </button>
            <button type="button" onClick={() => setConfirming(false)} disabled={finalizing} className="btn-secondary" style={{ flex: 1, justifyContent: "center" }}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {error && <p role="alert" style={{ color: "var(--color-error)", fontSize: "0.8125rem" }}>{error}</p>}
    </div>
  );
}
