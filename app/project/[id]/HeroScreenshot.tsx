"use client";

import { useState, useEffect, useCallback } from "react";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";

interface Props {
  screenshotUrls: string[];
  alt: string;
}

interface LightboxProps {
  urls: string[];
  index: number;
  onClose: () => void;
  onNav: (dir: 1 | -1) => void;
}

function Lightbox({ urls, index, onClose, onNav }: LightboxProps) {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onNav(1);
      if (e.key === "ArrowLeft") onNav(-1);
      if (e.key.toLowerCase() === "j") onNav(1);
      if (e.key.toLowerCase() === "k") onNav(-1);
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, onNav]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(0,0,0,0.88)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
      }}
      onClick={onClose}
    >
      {/* Image */}
      <img
        src={urls[index]}
        alt=""
        style={{
          maxWidth: "90vw",
          maxHeight: "90vh",
          objectFit: "contain",
          borderRadius: 8,
          boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
          display: "block",
        }}
        onClick={(e) => e.stopPropagation()}
      />

      {/* Close */}
      <button
        onClick={onClose}
        aria-label="Close"
        style={{
          position: "absolute",
          top: 16,
          right: 16,
          background: "rgba(255,255,255,0.12)",
          border: "none",
          color: "#fff",
          fontSize: "1.5rem",
          lineHeight: 1,
          width: 36,
          height: 36,
          borderRadius: "50%",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        ×
      </button>

      {/* Prev */}
      {urls.length > 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); onNav(-1); }}
          aria-label="Previous"
          style={navButtonStyle("left")}
        >
          ‹
        </button>
      )}

      {/* Next */}
      {urls.length > 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); onNav(1); }}
          aria-label="Next"
          style={navButtonStyle("right")}
        >
          ›
        </button>
      )}

      {/* Counter */}
      {urls.length > 1 && (
        <div
          style={{
            position: "absolute",
            bottom: 20,
            left: "50%",
            transform: "translateX(-50%)",
            color: "rgba(255,255,255,0.7)",
            fontSize: "0.8125rem",
            fontFamily: "var(--font-mono)",
            background: "rgba(0,0,0,0.4)",
            padding: "0.25rem 0.75rem",
            borderRadius: 999,
          }}
        >
          {index + 1} / {urls.length}
        </div>
      )}
    </div>
  );
}

function navButtonStyle(side: "left" | "right"): React.CSSProperties {
  return {
    position: "absolute",
    top: "50%",
    [side]: 16,
    transform: "translateY(-50%)",
    background: "rgba(255,255,255,0.12)",
    border: "none",
    color: "#fff",
    fontSize: "2rem",
    lineHeight: 1,
    width: 44,
    height: 44,
    borderRadius: "50%",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };
}

export function HeroScreenshot({ screenshotUrls, alt }: Props) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const activeUrl = screenshotUrls[activeIndex] ?? null;
  const hasMultiple = screenshotUrls.length > 1;

  const navigate = useCallback((dir: 1 | -1) => {
    if (screenshotUrls.length === 0) return;
    setActiveIndex((i) => (i + dir + screenshotUrls.length) % screenshotUrls.length);
  }, [screenshotUrls.length]);

  useKeyboardShortcuts(useCallback((event) => {
    if (!hasMultiple) return;
    if (event.key.toLowerCase() === "j") {
      event.preventDefault();
      navigate(1);
    }
    if (event.key.toLowerCase() === "k") {
      event.preventDefault();
      navigate(-1);
    }
  }, [hasMultiple, navigate]), !lightboxOpen);

  useEffect(() => {
    if (!lightboxOpen) return;
    document.body.dataset.shortcutModalOpen = "true";
    return () => {
      delete document.body.dataset.shortcutModalOpen;
    };
  }, [lightboxOpen]);

  return (
    // flex-col: thumbnail strip slots in below the hero card
    <div className="flex flex-col" style={{ gap: hasMultiple ? "0.5rem" : 0 }}>
      {/* Hero — mobile: aspect-video (16:9). Desktop: flex-1 fills grid row height. */}
      <div
        className="card aspect-video lg:aspect-auto lg:flex-1"
        style={{
          overflow: "hidden",
          padding: 0,
          maxHeight: 600,
          cursor: activeUrl ? "zoom-in" : "default",
        }}
        onClick={() => activeUrl && setLightboxOpen(true)}
      >
        {activeUrl ? (
          <img
            src={activeUrl}
            alt={alt}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              background:
                "linear-gradient(135deg, color-mix(in srgb, var(--color-accent) 18%, transparent), var(--color-surface-2))",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--color-subtle)",
            }}
          >
            No screenshot
          </div>
        )}
      </div>

      {/* Thumbnail strip — only shown when there are multiple screenshots */}
      {hasMultiple && (
        <div
          style={{
            display: "flex",
            gap: "0.5rem",
            overflowX: "auto",
            paddingBottom: "0.125rem",
            // hide scrollbar on webkit while keeping scroll functionality
            scrollbarWidth: "none",
          }}
        >
          {screenshotUrls.map((url, i) => (
            <button
              key={i}
              onClick={() => setActiveIndex(i)}
              aria-label={`Screenshot ${i + 1}`}
              style={{
                flexShrink: 0,
                width: 80,
                height: 52,
                padding: 0,
                border: `2px solid ${i === activeIndex ? "var(--color-accent)" : "var(--color-border)"}`,
                borderRadius: 6,
                overflow: "hidden",
                cursor: "pointer",
                background: "var(--color-surface-2)",
                transition: "border-color 150ms",
              }}
            >
              <img
                src={url}
                alt={`Screenshot ${i + 1}`}
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
            </button>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightboxOpen && (
        <Lightbox
          urls={screenshotUrls}
          index={activeIndex}
          onClose={() => setLightboxOpen(false)}
          onNav={navigate}
        />
      )}
    </div>
  );
}
