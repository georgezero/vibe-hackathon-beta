"use client";

import { type ReactNode, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShortcutHelpOverlay } from "@/components/ShortcutHelpOverlay";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";

interface Props {
  submissionIds: string[];
  children: ReactNode;
}

export function JudgeDashboardShortcuts({ submissionIds, children }: Props) {
  const router = useRouter();
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const cards = Array.from(document.querySelectorAll<HTMLElement>("[data-judge-submission-card]"));
    cards.forEach((card, index) => {
      card.dataset.active = index === selectedIndex ? "true" : "false";
    });

    if (selectedIndex >= 0) {
      cards[selectedIndex]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [selectedIndex]);

  const moveSelection = useCallback((direction: 1 | -1) => {
    if (submissionIds.length === 0) return;
    setSelectedIndex((current) => {
      if (current < 0) return direction === 1 ? 0 : submissionIds.length - 1;
      return (current + direction + submissionIds.length) % submissionIds.length;
    });
  }, [submissionIds.length]);

  const openSelected = useCallback(() => {
    if (selectedIndex < 0) return;
    const submissionId = submissionIds[selectedIndex];
    if (submissionId) router.push(`/judge/projects/${submissionId}`);
  }, [router, selectedIndex, submissionIds]);

  useKeyboardShortcuts(useCallback((event) => {
    if (event.key === "j") {
      event.preventDefault();
      moveSelection(1);
      return;
    }
    if (event.key === "k") {
      event.preventDefault();
      moveSelection(-1);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      openSelected();
      return;
    }
    if (event.key === "?") {
      event.preventDefault();
      setShowHelp((value) => !value);
      return;
    }
    if (event.key === "Escape") setShowHelp(false);
  }, [moveSelection, openSelected]));

  return (
    <>
      <style>{`
        [data-judge-submission-card][data-active="true"] {
          outline: 2px solid var(--color-accent);
          outline-offset: 4px;
          box-shadow: 0 0 0 5px color-mix(in srgb, var(--color-accent) 14%, transparent);
        }
      `}</style>
      {children}
      <ShortcutHelpOverlay open={showHelp} onClose={() => setShowHelp(false)} showJudging />
    </>
  );
}
