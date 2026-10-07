"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { ShortcutHelpOverlay } from "@/components/ShortcutHelpOverlay";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";

interface Props {
  currentId: string;
  projectIds: string[];
  githubUrl: string | null;
  demoUrl: string | null;
}

export function ProjectShortcuts({ currentId, projectIds, githubUrl, demoUrl }: Props) {
  const router = useRouter();
  const [helpOpen, setHelpOpen] = useState(false);
  const currentIndex = projectIds.indexOf(currentId);

  useKeyboardShortcuts(useCallback((event) => {
    if (event.key === "?") {
      event.preventDefault();
      setHelpOpen((open) => !open);
      return;
    }
    if (event.key === "Escape" && helpOpen) {
      event.preventDefault();
      setHelpOpen(false);
      return;
    }
    if (helpOpen) return;
    if (document.body.dataset.shortcutModalOpen === "true") return;

    if (event.key === "ArrowLeft" && currentIndex > 0) {
      event.preventDefault();
      router.push(`/project/${projectIds[currentIndex - 1]}`);
      return;
    }
    if (event.key === "ArrowRight" && currentIndex >= 0 && currentIndex < projectIds.length - 1) {
      event.preventDefault();
      router.push(`/project/${projectIds[currentIndex + 1]}`);
      return;
    }
    if (event.key.toLowerCase() === "g" && githubUrl) {
      event.preventDefault();
      window.open(githubUrl, "_blank", "noopener,noreferrer");
      return;
    }
    if (event.key.toLowerCase() === "d" && demoUrl) {
      event.preventDefault();
      window.open(demoUrl, "_blank", "noopener,noreferrer");
      return;
    }
    if (event.key.toLowerCase() === "v") {
      const card = document.getElementById("project-vote-card");
      const button = document.querySelector<HTMLButtonElement>("[data-project-vote-button='true']");
      if (card && button && !button.disabled) {
        event.preventDefault();
        card.scrollIntoView({ block: "center", behavior: "smooth" });
        window.setTimeout(() => {
          button.focus();
          button.click();
        }, 220);
      }
      return;
    }
    if (event.key.toLowerCase() === "c") {
      event.preventDefault();
      window.dispatchEvent(new Event("vibe:copy-project-link"));
      return;
    }
    if (event.key.toLowerCase() === "p") {
      event.preventDefault();
      router.push("/projects");
    }
  }, [currentIndex, demoUrl, githubUrl, helpOpen, projectIds, router]));

  return <ShortcutHelpOverlay open={helpOpen} onClose={() => setHelpOpen(false)} />;
}
