"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type Theme =
  | "dark-professional"
  | "light-classic"
  | "light-academic"
  | "light-creative"
  | "dark-neon"
  | "dark-terminal";

export const THEMES: { value: Theme; label: string; description: string }[] = [
  { value: "dark-professional", label: "Dark Professional", description: "Polished dark SaaS" },
  { value: "dark-neon", label: "Dark Neon", description: "Electric high-contrast" },
  { value: "dark-terminal", label: "Dark Terminal", description: "Retro terminal green" },
  { value: "light-classic", label: "Light Classic", description: "Clean and professional" },
  { value: "light-academic", label: "Light Academic", description: "Scholarly warm tones" },
  { value: "light-creative", label: "Light Creative", description: "Playful and energetic" },
];

const STORAGE_KEY = "vibe-theme";

// All theme color tokens defined in JS — applied via style.setProperty()
// so they always win over any CSS rule regardless of specificity or layer order.
const THEME_VARS: Record<Theme, Record<string, string>> = {
  "dark-professional": {
    "--color-bg": "#0A0A0C",
    "--color-surface": "#111115",
    "--color-surface-2": "#19191E",
    "--color-border": "#222229",
    "--color-fg": "#F0F0F4",
    "--color-muted": "#8888A0",
    "--color-subtle": "#505066",
    "--color-accent": "#E55B3C",
    "--color-accent-2": "#4A90D9",
    "--color-accent-fg": "#FFFFFF",
    "--color-success": "#22C55E",
    "--color-warning": "#F59E0B",
    "--color-error": "#EF4444",
    "--theme-glow": "none",
    "--theme-glow-accent": "none",
  },
  "light-classic": {
    "--color-bg": "#F5F5F8",
    "--color-surface": "#FFFFFF",
    "--color-surface-2": "#EBEBF2",
    "--color-border": "#DDDDE8",
    "--color-fg": "#0C0C12",
    "--color-muted": "#606070",
    "--color-subtle": "#9898A8",
    "--color-accent": "#E55B3C",
    "--color-accent-2": "#3B82F6",
    "--color-accent-fg": "#FFFFFF",
    "--color-success": "#16A34A",
    "--color-warning": "#D97706",
    "--color-error": "#DC2626",
    "--theme-glow": "none",
    "--theme-glow-accent": "none",
  },
  "light-academic": {
    "--color-bg": "#F3EEE4",
    "--color-surface": "#FAF6EF",
    "--color-surface-2": "#EAE3D8",
    "--color-border": "#D0C8BA",
    "--color-fg": "#1E1710",
    "--color-muted": "#6B5D50",
    "--color-subtle": "#9E8F82",
    "--color-accent": "#8B4513",
    "--color-accent-2": "#5B6FA8",
    "--color-accent-fg": "#FAF6EF",
    "--color-success": "#3D6B3A",
    "--color-warning": "#C07820",
    "--color-error": "#A83232",
    "--theme-glow": "none",
    "--theme-glow-accent": "none",
  },
  "light-creative": {
    "--color-bg": "#FFF5F0",
    "--color-surface": "#FFFFFF",
    "--color-surface-2": "#FFF0E8",
    "--color-border": "#FFD8C0",
    "--color-fg": "#1A0A04",
    "--color-muted": "#7A4836",
    "--color-subtle": "#B8846A",
    "--color-accent": "#F24B1A",
    "--color-accent-2": "#9B50E0",
    "--color-accent-fg": "#FFFFFF",
    "--color-success": "#16A34A",
    "--color-warning": "#D97706",
    "--color-error": "#DC2626",
    "--theme-glow": "none",
    "--theme-glow-accent": "none",
  },
  "dark-neon": {
    "--color-bg": "#050408",
    "--color-surface": "#0C0A12",
    "--color-surface-2": "#141020",
    "--color-border": "#201A30",
    "--color-fg": "#E8E4FF",
    "--color-muted": "#8878C0",
    "--color-subtle": "#504878",
    "--color-accent": "#8B5CF6",
    "--color-accent-2": "#06B6D4",
    "--color-accent-fg": "#FFFFFF",
    "--color-success": "#10B981",
    "--color-warning": "#F59E0B",
    "--color-error": "#F87171",
    "--theme-glow": "0 0 32px color-mix(in srgb, #8B5CF6 18%, transparent)",
    "--theme-glow-accent": "0 0 24px color-mix(in srgb, #8B5CF6 55%, transparent)",
  },
  "dark-terminal": {
    "--color-bg": "#020804",
    "--color-surface": "#050E08",
    "--color-surface-2": "#0A1A0E",
    "--color-border": "#113018",
    "--color-fg": "#B0E0B0",
    "--color-muted": "#5A9060",
    "--color-subtle": "#2E5A34",
    "--color-accent": "#00E836",
    "--color-accent-2": "#00D4FF",
    "--color-accent-fg": "#020804",
    "--color-success": "#00E836",
    "--color-warning": "#FFD700",
    "--color-error": "#FF4444",
    "--theme-glow": "0 0 32px color-mix(in srgb, #00E836 12%, transparent)",
    "--theme-glow-accent": "0 0 16px color-mix(in srgb, #00E836 60%, transparent)",
  },
};

function applyTheme(theme: Theme) {
  const el = document.documentElement;
  el.setAttribute("data-theme", theme);
  const vars = THEME_VARS[theme];
  for (const [key, val] of Object.entries(vars)) {
    el.style.setProperty(key, val);
  }
}

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark-professional",
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark-professional");

  useEffect(() => {
    const stored = (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? "dark-professional";
    setThemeState(stored);
    applyTheme(stored);
  }, []);

  function setTheme(t: Theme) {
    setThemeState(t);
    localStorage.setItem(STORAGE_KEY, t);
    applyTheme(t);
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
