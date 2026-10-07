"use client";

import { useState, useEffect, useRef } from "react";

type Theme =
  | "dark-professional"
  | "light-classic"
  | "light-academic"
  | "light-creative"
  | "dark-neon"
  | "dark-terminal";

const THEMES: { value: Theme; label: string; description: string; dot: string }[] = [
  { value: "dark-professional", label: "Dark Professional", description: "Polished dark SaaS", dot: "#E55B3C" },
  { value: "dark-neon",         label: "Dark Neon",         description: "Electric high-contrast", dot: "#8B5CF6" },
  { value: "dark-terminal",     label: "Dark Terminal",     description: "Retro terminal green",   dot: "#00E836" },
  { value: "light-classic",     label: "Light Classic",     description: "Clean and professional", dot: "#E55B3C" },
  { value: "light-academic",    label: "Light Academic",    description: "Scholarly warm tones",   dot: "#8B4513" },
  { value: "light-creative",    label: "Light Creative",    description: "Playful and energetic",  dot: "#F24B1A" },
];

const THEME_VARS: Record<Theme, Record<string, string>> = {
  "dark-professional": {
    "--color-bg": "#0A0A0C", "--color-surface": "#111115", "--color-surface-2": "#19191E",
    "--color-border": "#222229", "--color-fg": "#F0F0F4", "--color-muted": "#8888A0",
    "--color-subtle": "#505066", "--color-accent": "#E55B3C", "--color-accent-2": "#4A90D9",
    "--color-accent-fg": "#FFFFFF", "--color-success": "#22C55E", "--color-warning": "#F59E0B",
    "--color-error": "#EF4444", "--theme-glow": "none",
  },
  "light-classic": {
    "--color-bg": "#F5F5F8", "--color-surface": "#FFFFFF", "--color-surface-2": "#EBEBF2",
    "--color-border": "#DDDDE8", "--color-fg": "#0C0C12", "--color-muted": "#606070",
    "--color-subtle": "#9898A8", "--color-accent": "#E55B3C", "--color-accent-2": "#3B82F6",
    "--color-accent-fg": "#FFFFFF", "--color-success": "#16A34A", "--color-warning": "#D97706",
    "--color-error": "#DC2626", "--theme-glow": "none",
  },
  "light-academic": {
    "--color-bg": "#F3EEE4", "--color-surface": "#FAF6EF", "--color-surface-2": "#EAE3D8",
    "--color-border": "#D0C8BA", "--color-fg": "#1E1710", "--color-muted": "#6B5D50",
    "--color-subtle": "#9E8F82", "--color-accent": "#8B4513", "--color-accent-2": "#5B6FA8",
    "--color-accent-fg": "#FAF6EF", "--color-success": "#3D6B3A", "--color-warning": "#C07820",
    "--color-error": "#A83232", "--theme-glow": "none",
  },
  "light-creative": {
    "--color-bg": "#FFF5F0", "--color-surface": "#FFFFFF", "--color-surface-2": "#FFF0E8",
    "--color-border": "#FFD8C0", "--color-fg": "#1A0A04", "--color-muted": "#7A4836",
    "--color-subtle": "#B8846A", "--color-accent": "#F24B1A", "--color-accent-2": "#9B50E0",
    "--color-accent-fg": "#FFFFFF", "--color-success": "#16A34A", "--color-warning": "#D97706",
    "--color-error": "#DC2626", "--theme-glow": "none",
  },
  "dark-neon": {
    "--color-bg": "#050408", "--color-surface": "#0C0A12", "--color-surface-2": "#141020",
    "--color-border": "#201A30", "--color-fg": "#E8E4FF", "--color-muted": "#8878C0",
    "--color-subtle": "#504878", "--color-accent": "#8B5CF6", "--color-accent-2": "#06B6D4",
    "--color-accent-fg": "#FFFFFF", "--color-success": "#10B981", "--color-warning": "#F59E0B",
    "--color-error": "#F87171", "--theme-glow": "0 0 32px color-mix(in srgb, #8B5CF6 18%, transparent)",
  },
  "dark-terminal": {
    "--color-bg": "#020804", "--color-surface": "#050E08", "--color-surface-2": "#0A1A0E",
    "--color-border": "#113018", "--color-fg": "#B0E0B0", "--color-muted": "#5A9060",
    "--color-subtle": "#2E5A34", "--color-accent": "#00E836", "--color-accent-2": "#00D4FF",
    "--color-accent-fg": "#020804", "--color-success": "#00E836", "--color-warning": "#FFD700",
    "--color-error": "#FF4444", "--theme-glow": "0 0 32px color-mix(in srgb, #00E836 12%, transparent)",
  },
};

function applyTheme(theme: Theme) {
  const el = document.documentElement;
  el.setAttribute("data-theme", theme);
  for (const [k, v] of Object.entries(THEME_VARS[theme])) {
    el.style.setProperty(k, v);
  }
}

const STORAGE_KEY = "vibe-theme";

export function ThemeSelector() {
  const [current, setCurrent] = useState<Theme>("dark-professional");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? "dark-professional";
    setCurrent(stored);
    applyTheme(stored);
  }, []);

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  function selectTheme(t: Theme) {
    setCurrent(t);
    setOpen(false);
    localStorage.setItem(STORAGE_KEY, t);
    applyTheme(t);
  }

  const active = THEMES.find((t) => t.value === current) ?? THEMES[0];

  return (
    <div ref={ref} style={{ position: "relative" }}>
      {/* Toggle button */}
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "5px 10px", borderRadius: 8, border: "none",
          background: "transparent", cursor: "pointer",
          color: "var(--color-muted)", fontSize: "0.75rem", fontWeight: 500,
        }}
      >
        <Dot color={active.dot} />
        <span className="hidden sm:inline">{active.label}</span>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: "absolute", right: 0, top: "calc(100% + 6px)", zIndex: 9999,
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: 12, padding: 4, minWidth: 210,
          boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
        }}>
          {THEMES.map((t) => (
            <button
              key={t.value}
              onClick={() => selectTheme(t.value)}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                width: "100%", padding: "8px 12px", border: "none", borderRadius: 8,
                background: t.value === current ? "var(--color-surface-2)" : "transparent",
                color: t.value === current ? "var(--color-fg)" : "var(--color-muted)",
                cursor: "pointer", textAlign: "left",
              }}
            >
              <Dot color={t.dot} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "0.8125rem", fontWeight: 500, lineHeight: 1.3 }}>{t.label}</div>
                <div style={{ fontSize: "0.6875rem", color: "var(--color-subtle)", marginTop: 1 }}>{t.description}</div>
              </div>
              {t.value === current && (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ color: "var(--color-accent)", flexShrink: 0 }}>
                  <path d="M2.5 7L5.5 10L11.5 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Dot({ color }: { color: string }) {
  return (
    <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, display: "inline-block", flexShrink: 0 }} />
  );
}
