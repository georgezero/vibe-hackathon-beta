"use client";

import { useEffect, useState } from "react";

export function CopyLinkButton() {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(window.location.href);
    } catch {
      // Older browser fallback
      const input = document.createElement("input");
      input.value = window.location.href;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  useEffect(() => {
    function onShortcutCopy() {
      void handleCopy();
    }
    window.addEventListener("vibe:copy-project-link", onShortcutCopy);
    return () => window.removeEventListener("vibe:copy-project-link", onShortcutCopy);
  });

  return (
    <button onClick={handleCopy} className="btn-secondary">
      {copied ? "Copied ✓" : "Copy Link"}
    </button>
  );
}
