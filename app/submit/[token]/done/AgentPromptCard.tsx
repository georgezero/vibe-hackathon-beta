"use client";

import { useState } from "react";

export default function AgentPromptCard({ prompt, token }: { prompt: string; token: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function download() {
    const blob = new Blob([prompt], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `SUBMISSION_AGENT_${token.slice(0, 8)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="card" style={{ padding: "1.25rem", marginTop: "2rem" }}>
      <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
        <div>
          <div style={{ fontWeight: 600, color: "var(--color-fg)", fontSize: "0.9375rem", marginBottom: "0.25rem" }}>
            Agent submission prompt
          </div>
          <p style={{ fontSize: "0.8125rem", color: "var(--color-muted)", lineHeight: 1.55 }}>
            Paste this into Claude Code or any AI agent to auto-populate your submission. Your token is pre-filled.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={copy}
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "0.6875rem",
              padding: "0.3125rem 0.75rem",
              borderRadius: 6,
              border: "1px solid var(--color-border)",
              background: copied
                ? "color-mix(in srgb, var(--color-success) 15%, transparent)"
                : "var(--color-surface-2)",
              color: copied ? "var(--color-success)" : "var(--color-muted)",
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            {copied ? "Copied!" : "Copy prompt"}
          </button>
          <button
            onClick={download}
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "0.6875rem",
              padding: "0.3125rem 0.75rem",
              borderRadius: 6,
              border: "1px solid var(--color-border)",
              background: "var(--color-surface-2)",
              color: "var(--color-muted)",
              cursor: "pointer",
            }}
          >
            Download ↓
          </button>
        </div>
      </div>

      {/* Preview — first ~20 lines */}
      <div
        className="card"
        style={{ padding: "0.875rem 1rem", background: "var(--color-surface-2)", position: "relative" }}
      >
        <pre
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "0.6875rem",
            color: "var(--color-muted)",
            margin: 0,
            lineHeight: 1.7,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            maxHeight: "12rem",
            overflow: "hidden",
          }}
        >
          {prompt.split("\n").slice(0, 28).join("\n")}
        </pre>
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "4rem",
            background: "linear-gradient(transparent, var(--color-surface-2))",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            paddingBottom: "0.5rem",
          }}
        >
          <span style={{ fontSize: "0.6875rem", color: "var(--color-subtle)" }}>
            {prompt.split("\n").length} lines · copy or download to see full prompt
          </span>
        </div>
      </div>

      <div
        className="flex items-start gap-2 mt-3"
        style={{ fontSize: "0.75rem", color: "var(--color-subtle)", lineHeight: 1.5 }}
      >
        <span style={{ color: "var(--color-warning)", flexShrink: 0 }}>⚠</span>
        <span>The prompt contains your private edit token. Do not share it publicly.</span>
      </div>
    </div>
  );
}
