"use client";

import { useState, useEffect } from "react";

interface Props {
  targetMs: number;
  label: string;
}

function formatDuration(ms: number): string {
  if (ms <= 0) return "Ended";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h ${String(m).padStart(2, "0")}m`;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m ${String(sec).padStart(2, "0")}s`;
  return `${String(m).padStart(2, "0")}m ${String(sec).padStart(2, "0")}s`;
}

export function StatusCountdown({ targetMs, label }: Props) {
  const [display, setDisplay] = useState<string | null>(null);

  useEffect(() => {
    function tick() { setDisplay(formatDuration(targetMs - Date.now())); }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetMs]);

  if (!display) return null;

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: "0.625rem" }}>
      <span style={{ color: "var(--color-muted)", fontSize: "0.875rem", fontWeight: 500 }}>{label}</span>
      <span style={{
        fontFamily: "var(--font-mono)",
        fontWeight: 700,
        fontSize: "1rem",
        color: "var(--color-fg)",
        background: "var(--color-surface-2)",
        border: "1px solid var(--color-border)",
        padding: "0.25rem 0.875rem",
        borderRadius: 8,
        letterSpacing: "0.06em",
      }}>
        {display}
      </span>
    </div>
  );
}
