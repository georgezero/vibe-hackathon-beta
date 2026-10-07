"use client";

interface Props {
  open: boolean;
  onClose: () => void;
  showJudging?: boolean;
  showAdmin?: boolean;
}

export function ShortcutHelpOverlay({ open, onClose, showJudging = false, showAdmin = false }: Props) {
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.62)", backdropFilter: "blur(5px)" }} />
      <div className="card" style={{ position: "relative", width: "100%", maxWidth: 520, padding: "1.5rem" }}>
        <div className="flex items-start justify-between gap-4" style={{ marginBottom: "1rem" }}>
          <div>
            <div className="badge badge-accent" style={{ marginBottom: "0.75rem" }}>Keyboard</div>
            <h2 style={{ fontFamily: "var(--font-headline)", color: "var(--color-fg)", fontSize: "1.5rem", fontWeight: 800, letterSpacing: "-0.03em" }}>
              Keyboard Shortcuts
            </h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close shortcuts" className="btn-ghost">×</button>
        </div>
        <ShortcutSection
          title="Projects"
          rows={[
            ["j / k", "Next / Previous Project"],
            ["Enter", "Open Project"],
          ]}
        />
        <ShortcutSection
          title="Project Detail"
          rows={[
            ["← →", "Previous / Next Project"],
            ["j / k", "Next / Previous Screenshot"],
            ["g", "Open GitHub"],
            ["d", "Open Demo"],
            ["v", "Open Vote Dialog"],
            ["c", "Copy Link"],
            ["p", "Back to Projects"],
            ["?", "Toggle Help"],
          ]}
        />
        {showJudging && (
          <ShortcutSection
            title="Judging"
            rows={[
              ["j / k", "Next / Previous Rubric Field"],
              ["← →", "Previous / Next Submission"],
              ["1–9", "Set Score"],
              ["0", "Set Score = 10"],
              ["Tab", "Next Rubric Field"],
              ["Shift+Tab", "Previous Rubric Field"],
              ["Cmd/Ctrl+Enter", "Submit Scorecard"],
              ["p", "Back to Judge List"],
            ]}
          />
        )}
        {showAdmin && (
          <ShortcutSection
            title="Admin"
            rows={[
              ["← →", "Previous / Next Tab"],
              ["1–9, 0", "Jump To Tab"],
              ["a", "AI Reviews"],
              ["s", "Submissions"],
              ["e", "Event Settings"],
              ["r", "Release Checklist"],
              ["w", "Winners"],
              ["?", "Toggle Help"],
            ]}
          />
        )}
        <div style={{ color: "var(--color-subtle)", fontSize: "0.8125rem", marginTop: "1rem" }}>
          ESC closes dialogs.
        </div>
      </div>
    </div>
  );
}

function ShortcutSection({ title, rows }: { title: string; rows: Array<[string, string]> }) {
  return (
    <div style={{ marginTop: "1rem" }}>
      <h3 style={{ color: "var(--color-fg)", fontWeight: 800, fontSize: "0.875rem", marginBottom: "0.5rem" }}>{title}</h3>
      <div className="flex flex-col gap-1">
        {rows.map(([keys, label]) => (
          <div key={keys} className="flex items-center gap-4" style={{ color: "var(--color-muted)", fontSize: "0.875rem" }}>
            <kbd style={{ fontFamily: "var(--font-mono)", color: "var(--color-accent)", minWidth: 70 }}>{keys}</kbd>
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
