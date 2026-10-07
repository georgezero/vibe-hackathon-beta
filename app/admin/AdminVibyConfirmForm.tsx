"use client";

import { useState } from "react";

export function AdminVibyConfirmForm({ callbackPath }: { callbackPath: string }) {
  const [assertionId, setAssertionId] = useState("");
  const target = assertionId.trim()
    ? `${callbackPath}?assertionId=${encodeURIComponent(assertionId.trim())}`
    : callbackPath;

  return (
    <form action={target} method="get" className="flex flex-col gap-3">
      <label className="label">Viby assertion ID</label>
      <input
        className="input"
        name="assertionId"
        value={assertionId}
        onChange={(event) => setAssertionId(event.target.value)}
        placeholder="Paste vibe-hackathon assertion ID"
        autoComplete="off"
        spellCheck={false}
      />
      <p style={{ color: "var(--color-muted)", fontSize: "0.75rem", lineHeight: 1.5 }}>
        Paste a Viby assertion ID scoped to vibe-hackathon. Generic mock-host assertions will be rejected.
      </p>
      <button type="submit" className="btn-primary" style={{ justifyContent: "center" }} disabled={!assertionId.trim()}>
        Verify assertion and enter dashboard
      </button>
    </form>
  );
}
