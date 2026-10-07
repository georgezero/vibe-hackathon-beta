"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { InstitutionWorldMap } from "@/components/InstitutionWorldMap";
import type { InstitutionRow } from "@/lib/event-status";
import type { EventHub } from "@/lib/institution-geo";

const ParticipationGlobe = dynamic(() => import("./ParticipationGlobe"), {
  ssr: false,
  loading: () => (
    <div style={{ height: "clamp(300px, 43vw, 475px)", display: "grid", placeItems: "center", color: "var(--color-muted)", background: "rgba(4, 8, 14, 0.98)" }}>
      Loading globe...
    </div>
  ),
});

const STORAGE_KEY = "vibe-status-map-view";
type ViewMode = "map" | "globe";

interface Props {
  institutions: InstitutionRow[];
  hub: EventHub;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable;
}

export function ParticipationVisualization({ institutions, hub }: Props) {
  const [view, setView] = useState<ViewMode>("map");
  const [fullscreen, setFullscreen] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "map" || stored === "globe") setView(stored);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    window.localStorage.setItem(STORAGE_KEY, view);
  }, [ready, view]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isTypingTarget(event.target)) return;
      if (event.key === "Escape") {
        if (fullscreen) setFullscreen(false);
        return;
      }
      if (event.key.toLowerCase() === "f" && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        setFullscreen((value) => !value);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [fullscreen]);

  function renderVisual(expanded: boolean) {
    return view === "globe"
      ? <ParticipationGlobe institutions={institutions} hub={hub} fullscreen={expanded} />
      : <InstitutionWorldMap institutions={institutions} hub={hub} expanded={expanded} hideFullscreenButton />;
  }

  return (
    <div style={{ position: "relative" }}>
      <div
        style={{
          position: "absolute",
          top: 10,
          right: 10,
          zIndex: 5,
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: 4,
          borderRadius: 12,
          background: "rgba(8, 12, 20, 0.76)",
          border: "1px solid rgba(255,255,255,0.12)",
          backdropFilter: "blur(10px)",
        }}
      >
        {(["map", "globe"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => setView(mode)}
            aria-pressed={view === mode}
            style={{
              border: 0,
              borderRadius: 9,
              padding: "0.36rem 0.58rem",
              fontSize: "0.72rem",
              fontWeight: 800,
              letterSpacing: "0.02em",
              color: view === mode ? "#111318" : "var(--color-muted)",
              background: view === mode ? "var(--color-accent)" : "transparent",
              cursor: "pointer",
            }}
          >
            {mode === "map" ? "Map" : "Globe"}
          </button>
        ))}
        <button
          type="button"
          aria-label="Open visualization fullscreen"
          onClick={() => setFullscreen(true)}
          className="btn-ghost"
          style={{
            width: 31,
            height: 31,
            padding: 0,
            borderRadius: 9,
            color: "var(--color-fg)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            border: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          ⛶
        </button>
      </div>
      {!fullscreen && renderVisual(false)}
      {fullscreen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Participation visualization fullscreen"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            background: "rgba(2, 5, 10, 0.96)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "clamp(0.75rem, 2vw, 2rem)",
          }}
        >
          <button
            type="button"
            onClick={() => setFullscreen(false)}
            aria-label="Close fullscreen visualization"
            className="btn-secondary"
            style={{ position: "absolute", top: 16, right: 16, zIndex: 103 }}
          >
            Close · ESC
          </button>
          <div
            style={{
              position: "relative",
              width: "90vw",
              height: view === "map" ? "min(85vh, 40vw)" : "85vh",
              overflow: "hidden",
              borderRadius: 18,
              border: "1px solid rgba(255,255,255,0.14)",
              boxShadow: "0 28px 90px rgba(0,0,0,0.55)",
              background: "rgba(4, 8, 14, 0.98)",
            }}
          >
            <div style={{ position: "absolute", top: 14, right: 14, zIndex: 102 }}>
              <div
                style={{
                  display: "flex",
                  gap: 6,
                  padding: 4,
                  borderRadius: 12,
                  background: "rgba(8, 12, 20, 0.72)",
                  border: "1px solid rgba(255,255,255,0.12)",
                }}
              >
                {(["map", "globe"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setView(mode)}
                    aria-pressed={view === mode}
                    style={{
                      border: 0,
                      borderRadius: 9,
                      padding: "0.42rem 0.7rem",
                      fontSize: "0.75rem",
                      fontWeight: 850,
                      color: view === mode ? "#111318" : "var(--color-muted)",
                      background: view === mode ? "var(--color-accent)" : "transparent",
                      cursor: "pointer",
                    }}
                  >
                    {mode === "map" ? "Map" : "Globe"}
                  </button>
                ))}
              </div>
            </div>
            {renderVisual(true)}
          </div>
        </div>
      )}
    </div>
  );
}
