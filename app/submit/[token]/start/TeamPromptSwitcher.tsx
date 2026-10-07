"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AgentCompletionPrompt } from "@/components/AgentCompletionPrompt";

type TeamPerson = {
  name: string;
  email: string | null;
  badgeNumber: string | null;
  affiliation: string | null;
  degrees: string | null;
  isStudentTrainee: boolean;
};

export function TeamPromptSwitcher({
  submissionId,
  editToken,
  editUrl,
  previewUrl,
  finalizeUrl,
  baseUrl,
  currentOwner,
  currentMembers,
}: {
  submissionId: string;
  editToken: string;
  editUrl: string;
  previewUrl: string;
  finalizeUrl: string | null;
  baseUrl: string;
  currentOwner: TeamPerson | null;
  currentMembers: TeamPerson[];
}) {
  const router = useRouter();
  const [variant, setVariant] = useState<"current" | "initial">("current");
  const [visibleMembers, setVisibleMembers] = useState(currentMembers);
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState("");
  const hasCurrentTeam = visibleMembers.length > 0;

  async function resetToOwnerOnly() {
    if (!currentOwner) return;
    const confirmed = window.confirm("Reset team roster to the current owner only? This removes all teammates from this draft.");
    if (!confirmed) return;
    setResetting(true);
    setResetError("");
    const res = await fetch(`/api/v1/submissions/${submissionId}/team`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${editToken}` },
      body: JSON.stringify({
        owner: currentOwner,
        members: [],
      }),
    });
    setResetting(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setResetError(data.error ?? "Reset failed.");
      return;
    }
    setVisibleMembers([]);
    setVariant("initial");
    router.refresh();
  }

  return (
    <section id="agent-prompt" aria-labelledby="agent-prompt-title" style={{ marginTop: "1.5rem" }}>
      <div style={{ marginBottom: "0.85rem" }}>
        <h2 id="agent-prompt-title" style={{ color: "var(--color-fg)", fontFamily: "var(--font-headline)", fontSize: "1.45rem", letterSpacing: "-0.03em" }}>Agent setup</h2>
        <p style={{ color: "var(--color-muted)", fontSize: "0.84rem", lineHeight: 1.6, marginTop: "0.3rem" }}>Choose the team context your agent should use, then copy the private prompt. Return here to review the preview; the agent will not submit for you.</p>
      </div>
      <div className="flex flex-wrap gap-2" style={{ marginBottom: "0.75rem" }}>
        {hasCurrentTeam && (
          <button
            type="button"
            className={variant === "current" ? "btn-primary" : "btn-secondary"}
            onClick={() => setVariant("current")}
          >
            Use current team
          </button>
        )}
        <button
          type="button"
          className={!hasCurrentTeam || variant === "initial" ? "btn-primary" : "btn-secondary"}
          onClick={() => setVariant("initial")}
        >
          Team lead only
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={resetToOwnerOnly}
          disabled={resetting || !currentOwner}
          style={{
            marginLeft: "auto",
            background: "var(--color-surface-2)",
            borderColor: "var(--color-border)",
            color: "var(--color-muted)",
          }}
        >
          {resetting ? "Resetting…" : "Reset team"}
        </button>
      </div>
      {resetError && <div className="badge badge-error" style={{ marginBottom: "0.75rem" }}>{resetError}</div>}
      <p style={{ color: "var(--color-subtle)", fontSize: "0.8125rem", lineHeight: 1.55, marginBottom: "1rem" }}>
        {variant === "current"
          ? "Use the latest saved team when you are making edits or corrections."
          : "Start with the team lead only, then add teammates in the prompt or browser form."}
      </p>
      <AgentCompletionPrompt
        submissionId={submissionId}
        editToken={editToken}
        editUrl={editUrl}
        previewUrl={previewUrl}
        finalizeUrl={finalizeUrl}
        baseUrl={baseUrl}
        mode="setup"
        setupVariant={hasCurrentTeam ? variant : "initial"}
        promptDisclosure
        title="Copy private agent prompt"
        currentOwner={currentOwner}
        currentMembers={hasCurrentTeam && variant === "current" ? visibleMembers : []}
      />
    </section>
  );
}
