"use client";

import { useEffect } from "react";

export type ShortcutHandler = (event: KeyboardEvent) => void;

interface ShortcutOptions {
  allowModified?: boolean;
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable;
}

function isTouchDevice() {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(pointer: coarse)").matches;
}

export function useKeyboardShortcuts(handler: ShortcutHandler, enabled = true, options: ShortcutOptions = {}) {
  useEffect(() => {
    if (!enabled || isTouchDevice()) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.altKey) return;
      if (!options.allowModified && (event.metaKey || event.ctrlKey)) return;
      if (isEditableTarget(event.target)) return;
      handler(event);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled, handler, options.allowModified]);
}
