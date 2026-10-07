"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { VerifiedArtifact } from "@/lib/verifiedArtifacts";

const HISTORY_KEY = "vibe.verifiedArtifacts.recent";
const MAX_HISTORY = 8;

type HistoryItem = {
  artifactId: string;
  artifactType: string;
  title: string;
  generatedByAgentName: string;
  ownerDisplayName: string;
  createdAt: string;
  token: string;
};

function readHistory(): HistoryItem[] {
  try {
    const raw = window.sessionStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is HistoryItem => {
      return Boolean(item)
        && typeof item === "object"
        && typeof (item as HistoryItem).artifactId === "string"
        && typeof (item as HistoryItem).token === "string";
    });
  } catch {
    return [];
  }
}

function writeHistory(items: HistoryItem[]) {
  window.sessionStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, MAX_HISTORY)));
}

function artifactLabel(value: string) {
  return value
    .split("-")
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}

export function VerifiedArtifactControls({
  artifact,
  artifactToken,
  exportText,
}: {
  artifact?: VerifiedArtifact | null;
  artifactToken?: string | null;
  exportText?: string | null;
}) {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const existing = readHistory();
    if (!artifact || !artifactToken) {
      setHistory(existing);
      return;
    }

    const nextItem: HistoryItem = {
      artifactId: artifact.artifactId,
      artifactType: artifact.artifactType,
      title: artifact.projectTitle,
      generatedByAgentName: artifact.generatedByAgentName,
      ownerDisplayName: artifact.ownerDisplayName,
      createdAt: artifact.createdAt,
      token: artifactToken,
    };
    const next = [
      nextItem,
      ...existing.filter((item) => item.artifactId !== artifact.artifactId),
    ].slice(0, MAX_HISTORY);
    writeHistory(next);
    setHistory(next);
  }, [artifact, artifactToken]);

  const downloadHref = useMemo(() => {
    if (!exportText) return null;
    return URL.createObjectURL(new Blob([exportText], { type: "text/plain;charset=utf-8" }));
  }, [exportText]);

  async function copyArtifact() {
    if (!exportText) return;
    await navigator.clipboard.writeText(exportText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <div className="grid gap-3">
      {artifact && exportText && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={copyArtifact}
            className="btn-primary"
            style={{ justifyContent: "center" }}
          >
            {copied ? "Copied" : "Copy Artifact"}
          </button>
          {downloadHref && (
            <a
              className="btn-secondary"
              href={downloadHref}
              download={`${artifact.artifactType}-${artifact.artifactId.slice(0, 8)}.txt`}
              style={{ justifyContent: "center", textDecoration: "none" }}
            >
              Download .txt
            </a>
          )}
          {artifactToken && (
            <Link
              className="btn-secondary"
              href={`/admin/verified-agent-artifacts/${artifact.artifactId}?artifact=${encodeURIComponent(artifactToken)}`}
              style={{ justifyContent: "center", textDecoration: "none" }}
            >
              Open Details
            </Link>
          )}
        </div>
      )}

      <section className="card" style={{ padding: "1rem" }}>
        <h2 style={{ color: "var(--color-fg)", fontWeight: 850, fontSize: "1rem", marginBottom: "0.25rem" }}>
          Recent Verified Artifacts
        </h2>
        <p style={{ color: "var(--color-muted)", fontSize: "0.8rem", lineHeight: 1.45, marginBottom: "0.75rem" }}>
          Session-scoped history for artifacts generated in this browser tab.
        </p>
        {history.length === 0 ? (
          <div style={{ color: "var(--color-muted)", fontSize: "0.875rem" }}>
            No verified artifacts in this session yet.
          </div>
        ) : (
          <div className="grid gap-2">
            {history.map((item) => (
              <Link
                key={item.artifactId}
                href={`/admin/verified-agent-artifacts/${item.artifactId}?artifact=${encodeURIComponent(item.token)}`}
                className="card"
                style={{ padding: "0.75rem", textDecoration: "none" }}
              >
                <div style={{ color: "var(--color-fg)", fontWeight: 800, fontSize: "0.875rem" }}>
                  {artifactLabel(item.artifactType)}
                </div>
                <div style={{ color: "var(--color-muted)", fontSize: "0.76rem", marginTop: "0.2rem" }}>
                  {item.generatedByAgentName} · {new Date(item.createdAt).toLocaleString()}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
