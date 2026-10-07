"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { AwardBadges } from "@/components/AwardBadges";
import { PublicTeamSpotlightCard } from "@/components/PublicTeamSpotlightCard";
import { WORLD_DOTS, WORLD_MAP_H, WORLD_MAP_W, worldMapPx } from "@/components/InstitutionWorldMap";
import { buildPresentationDotRotation, type PresentationRotationItem } from "@/lib/presentation-rotation";
import type { PresentationLiveData, PresentationProject } from "@/lib/presentation-data";

const GLOBAL_MS = 3000;
const ZOOM_MS = 2000;
const SPOTLIGHT_MS = 10000;
const RESET_MS = 2000;
const CYCLE_MS = GLOBAL_MS + ZOOM_MS + SPOTLIGHT_MS + RESET_MS;

type CameraTransform = {
  x: number;
  y: number;
  scale: number;
};

function phaseFor(elapsed: number) {
  const t = elapsed % CYCLE_MS;
  if (t < GLOBAL_MS) return "global";
  if (t < GLOBAL_MS + ZOOM_MS) return "zoom";
  if (t < GLOBAL_MS + ZOOM_MS + SPOTLIGHT_MS) return "spotlight";
  return "reset";
}

function easeOutExpo(t: number) {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

function transformFor(item: PresentationRotationItem | null, phase: string): CameraTransform {
  if (!item?.featuredInstitution || phase === "global" || phase === "reset") return { x: 0, y: 0, scale: 1 };
  const [x, y] = worldMapPx(item.featuredInstitution.geo.lng, item.featuredInstitution.geo.lat);
  const scale = phase === "zoom" ? 1.85 : 2.25;
  const dx = WORLD_MAP_W / 2 - x * scale;
  const dy = WORLD_MAP_H / 2 - y * scale;
  return { x: dx, y: dy, scale };
}

function cameraToSvgTransform(camera: CameraTransform) {
  return `translate(${camera.x} ${camera.y}) scale(${camera.scale})`;
}

export function PresentationStage({ initialData }: { initialData: PresentationLiveData }) {
  const [data, setData] = useState(initialData);
  const [paused, setPaused] = useState(false);
  const [manualIndex, setManualIndex] = useState(0);
  const [manualLoop, setManualLoop] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [debugPresentation, setDebugPresentation] = useState(false);
  const [camera, setCamera] = useState<CameraTransform>({ x: 0, y: 0, scale: 1 });
  const [presentationSeed] = useState(() => {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
    return `${Date.now()}-${Math.random()}`;
  });
  const startedAt = useRef(Date.now());
  const hiddenTimer = useRef<number | null>(null);
  const cameraRef = useRef<CameraTransform>({ x: 0, y: 0, scale: 1 });
  const cameraAnimationRef = useRef<number | null>(null);
  const spotlightGridRef = useRef<HTMLDivElement | null>(null);

  const seed = presentationSeed;
  const firstLoopOrder = useMemo(() => buildPresentationDotRotation(data.projects, data.institutions, seed, 0), [data.projects, data.institutions, seed]);
  const loopLength = firstLoopOrder.length;
  const cycleNumber = loopLength ? Math.floor(elapsed / CYCLE_MS) : 0;
  const autoLoop = loopLength ? Math.floor(cycleNumber / loopLength) : 0;
  const autoIndex = loopLength ? cycleNumber % loopLength : 0;
  const activeLoop = paused ? manualLoop : autoLoop;
  const order = useMemo(() => buildPresentationDotRotation(data.projects, data.institutions, seed, activeLoop), [data.projects, data.institutions, seed, activeLoop]);
  const activeIndex = order.length ? manualIndex % order.length : 0;
  const activeItem = order[paused ? activeIndex : autoIndex] ?? null;
  const activeProject = activeItem?.project ?? null;
  const phase = paused ? "spotlight" : phaseFor(elapsed);
  const cycleElapsed = elapsed % CYCLE_MS;
  const cameraPhase = phase === "global" && cycleElapsed > 900 ? "zoom" : phase;
  const selectedInstitution = activeItem?.featuredInstitution?.name ?? null;
  const cardsVisible = activeProject && (phase === "spotlight" || paused);

  useEffect(() => {
    setDebugPresentation(new URLSearchParams(window.location.search).get("debugPresentation") === "1");
  }, []);

  useEffect(() => {
    document.body.classList.add("presentation-mode");
    return () => document.body.classList.remove("presentation-mode");
  }, []);

  useEffect(() => {
    if (paused) return;
    const id = window.setInterval(() => setElapsed(Date.now() - startedAt.current), 250);
    return () => window.clearInterval(id);
  }, [paused]);

  useEffect(() => {
    const id = window.setInterval(async () => {
      try {
        const res = await fetch("/api/v1/presentation/live", { cache: "no-store" });
        if (!res.ok) return;
        const next = (await res.json()) as PresentationLiveData;
        setData((current) => {
          const currentId = activeProject?.id;
          const stillExists = currentId && next.projects.some((project) => project.id === currentId);
          if (!stillExists) setManualIndex(0);
          return next;
        });
      } catch {
        // Keep the current presentation data during transient network failures.
      }
    }, 25_000);
    return () => window.clearInterval(id);
  }, [activeProject?.id]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target;
      if (target instanceof HTMLElement) {
        const tag = target.tagName.toLowerCase();
        if (tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable) return;
      }
      if (event.key === " ") {
        event.preventDefault();
        setPaused((value) => !value);
        if (!paused) {
          setManualIndex(autoIndex);
          setManualLoop(autoLoop);
        }
      }
      if (event.key === "ArrowRight" && loopLength) {
        event.preventDefault();
        setPaused(true);
        setManualIndex((value) => {
          const next = (value + 1) % loopLength;
          if (next === 0) setManualLoop((loop) => loop + 1);
          return next;
        });
      }
      if (event.key === "ArrowLeft" && loopLength) {
        event.preventDefault();
        setPaused(true);
        setManualIndex((value) => {
          const next = (value - 1 + loopLength) % loopLength;
          if (value === 0) setManualLoop((loop) => Math.max(0, loop - 1));
          return next;
        });
      }
      if (event.key.toLowerCase() === "f" && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
        else document.exitFullscreen?.();
      }
      if (event.key === "Escape" && document.fullscreenElement) document.exitFullscreen?.();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [autoIndex, autoLoop, loopLength, paused]);

  function showControls() {
    setControlsVisible(true);
    if (hiddenTimer.current) window.clearTimeout(hiddenTimer.current);
    hiddenTimer.current = window.setTimeout(() => setControlsVisible(false), 2600);
  }

  const maxParticipants = Math.max(...data.institutions.map((inst) => inst.participants), 1);
  const targetCamera = transformFor(activeItem, cameraPhase);
  const mapTransform = cameraToSvgTransform(camera);
  const featuredPoint = activeItem?.featuredInstitution
    ? worldMapPx(activeItem.featuredInstitution.geo.lng, activeItem.featuredInstitution.geo.lat)
    : null;
  const institutionLabel = activeItem?.featuredInstitution
    ? `📍 ${activeItem.featuredInstitution.displayName.toUpperCase()}`
    : null;
  const presentationInset = "clamp(0.55rem, 1.6vw, 1.35rem)";

  useEffect(() => {
    if (cameraAnimationRef.current) window.cancelAnimationFrame(cameraAnimationRef.current);

    const from = cameraRef.current;
    const to = targetCamera;
    const duration = phase === "spotlight" ? 1250 : 2000;
    const started = performance.now();

    function step(now: number) {
      const t = Math.min(1, (now - started) / duration);
      const eased = easeOutExpo(t);
      const next = {
        x: from.x + (to.x - from.x) * eased,
        y: from.y + (to.y - from.y) * eased,
        scale: from.scale + (to.scale - from.scale) * eased,
      };
      cameraRef.current = next;
      setCamera(next);
      if (t < 1) cameraAnimationRef.current = window.requestAnimationFrame(step);
    }

    cameraAnimationRef.current = window.requestAnimationFrame(step);

    return () => {
      if (cameraAnimationRef.current) window.cancelAnimationFrame(cameraAnimationRef.current);
    };
  }, [targetCamera.x, targetCamera.y, targetCamera.scale, phase]);

  useEffect(() => {
    if (phase === "spotlight" || paused) {
      spotlightGridRef.current?.scrollTo({ top: 0, behavior: "auto" });
    }
  }, [activeProject?.id, phase, paused]);

  return (
    <main
      onMouseMove={showControls}
      style={{
        minHeight: "100vh",
        overflow: "hidden",
        background: "radial-gradient(circle at 50% 45%, rgba(25,38,58,0.88), rgba(4,7,13,1) 58%)",
        color: "var(--color-fg)",
        position: "relative",
      }}
    >
      <style>{`
        @keyframes presentation-dot-pulse {
          0%, 100% { opacity: 0.62; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.45); }
        }
        @keyframes presentation-ring {
          0% { opacity: 0.28; transform: scale(0.8); }
          100% { opacity: 0; transform: scale(3.3); }
        }
        @keyframes presentation-card-in {
          from { opacity: 0; transform: translateY(18px) scale(0.985); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .presentation-map-group { transition: none !important; }
          .presentation-pulse, .presentation-ring, .presentation-card { animation: none !important; }
        }
        body.presentation-mode > footer {
          display: none !important;
        }
        @media (max-width: 900px) {
          .presentation-spotlight-grid {
            grid-template-columns: 1fr !important;
            align-content: center;
            overflow-y: auto;
          }
          .presentation-footer,
          .presentation-controls {
            display: none !important;
          }
        }
      `}</style>

      <svg
        viewBox={`0 0 ${WORLD_MAP_W} ${WORLD_MAP_H}`}
        preserveAspectRatio="xMidYMid slice"
        aria-label="Global participation presentation map"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }}
      >
        <defs>
          <filter id="presentation-glow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <radialGradient id="presentation-ocean" cx="50%" cy="45%" r="75%">
            <stop offset="0%" stopColor="rgba(17,27,44,0.98)" />
            <stop offset="68%" stopColor="rgba(7,12,22,0.99)" />
            <stop offset="100%" stopColor="rgba(2,5,10,1)" />
          </radialGradient>
        </defs>
        <rect width={WORLD_MAP_W} height={WORLD_MAP_H} fill="url(#presentation-ocean)" />
        <g className="presentation-map-group" transform={mapTransform}>
          <g aria-hidden>
            {WORLD_DOTS.map((dot) => (
              <circle key={dot.id} cx={dot.x} cy={dot.y} r={dot.r * 1.06} fill="rgb(142,162,184)" opacity={dot.opacity * 1.08} />
            ))}
          </g>
          {data.institutions.map((inst) => {
            const [x, y] = worldMapPx(inst.geo.lng, inst.geo.lat);
            const selected = inst.name === selectedInstitution;
            const r = 3.4 + (inst.participants / maxParticipants) * 5.5;
            return (
              <g key={inst.name} style={{ opacity: selected || !cardsVisible ? 1 : 0.42, transition: "opacity 900ms ease" }}>
                <circle cx={x} cy={y} r={r * 2.5} fill="var(--color-accent)" opacity={selected ? 0.22 : 0.055} filter="url(#presentation-glow)" />
                {selected && <circle className="presentation-ring" cx={x} cy={y} r={r * 1.5} fill="none" stroke="var(--color-accent)" strokeWidth={0.8} style={{ transformBox: "fill-box", transformOrigin: "center", animation: "presentation-ring 2.8s ease-out infinite" }} />}
                <circle className="presentation-pulse" cx={x} cy={y} r={selected ? r * 1.45 : r} fill="var(--color-accent)" opacity={selected ? 0.95 : 0.68} style={{ transformBox: "fill-box", transformOrigin: "center", animation: selected ? "presentation-dot-pulse 1.8s ease-in-out infinite" : "presentation-dot-pulse 6s ease-in-out infinite" }} />
              </g>
            );
          })}
          {(() => {
            const [x, y] = worldMapPx(data.hub.lng, data.hub.lat);
            return <circle cx={x} cy={y} r={7.5} fill="white" opacity={0.72} filter="url(#presentation-glow)" />;
          })()}
          {featuredPoint && phase !== "global" && phase !== "reset" && (
            <g pointerEvents="none">
              <circle cx={featuredPoint[0]} cy={featuredPoint[1]} r={19} fill="var(--color-accent)" opacity={0.22} filter="url(#presentation-glow)" />
              <circle className="presentation-ring" cx={featuredPoint[0]} cy={featuredPoint[1]} r={13} fill="none" stroke="white" strokeWidth={1.1} style={{ transformBox: "fill-box", transformOrigin: "center", animation: "presentation-ring 2.2s ease-out infinite" }} />
              <circle cx={featuredPoint[0]} cy={featuredPoint[1]} r={8.5} fill="white" opacity={0.9} />
            </g>
          )}
        </g>
      </svg>

      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "linear-gradient(90deg, rgba(2,5,10,0.55), transparent 24%, transparent 76%, rgba(2,5,10,0.55))" }} />

      {data.projects.length === 0 ? (
        <div style={{ position: "relative", zIndex: 2, minHeight: "100vh", display: "grid", placeItems: "center", padding: "2rem", textAlign: "center" }}>
          <div style={{ maxWidth: 760 }}>
            <div style={{ color: "var(--color-accent)", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.18em", fontWeight: 900, marginBottom: "1rem" }}>Live Presentation</div>
            <h1 style={{ fontFamily: "var(--font-headline)", fontSize: "clamp(2.2rem, 6vw, 5rem)", fontWeight: 950, letterSpacing: "-0.06em", lineHeight: 0.95 }}>Project spotlights will appear here.</h1>
            <p style={{ color: "var(--color-muted)", fontSize: "clamp(1rem, 2vw, 1.35rem)", marginTop: "1rem" }}>Live project spotlights will appear here as teams finalize submissions.</p>
          </div>
        </div>
      ) : cardsVisible && activeProject ? (
        <div
          ref={spotlightGridRef}
          className="presentation-card presentation-spotlight-grid"
          style={{
            position: "relative",
            zIndex: 2,
            minHeight: "100vh",
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.25fr) minmax(330px, 0.85fr)",
            gap: "clamp(1rem, 2vw, 1.8rem)",
            alignItems: "center",
            padding: `clamp(5.1rem, 8.5vh, 7.25rem) ${presentationInset} ${presentationInset}`,
            animation: "presentation-card-in 700ms ease-out both",
          }}
        >
          <ProjectSpotlightCard project={activeProject} />
          <div style={{ display: "grid", gap: "0.75rem", alignContent: "center" }}>
            <PublicTeamSpotlightCard teamName={activeProject.teamName} members={activeProject.teamMembers} leadInstitution={activeItem?.featuredInstitution?.displayName ?? activeProject.leadInstitution} />
          </div>
        </div>
      ) : null}

      {activeItem?.featuredInstitution && (phase === "zoom" || phase === "spotlight" || paused) && (
        <div
          className="presentation-institution-badge"
          style={{
            position: "fixed",
            left: presentationInset,
            top: presentationInset,
            zIndex: 4,
            border: "1px solid rgba(255,255,255,0.16)",
            borderRadius: 999,
            background: "rgba(5, 9, 16, 0.68)",
            backdropFilter: "blur(12px)",
            color: "var(--color-fg)",
            fontSize: "clamp(1.08rem, 1.76vw, 1.92rem)",
            fontWeight: 900,
            letterSpacing: "0.035em",
            lineHeight: 1,
            padding: "0.62rem 0.95rem",
          }}
        >
          {institutionLabel}
        </div>
      )}

      {debugPresentation && activeItem && (
        <div style={{ position: "fixed", left: 18, bottom: 18, zIndex: 5, background: "rgba(0,0,0,0.72)", color: "white", border: "1px solid rgba(255,255,255,0.18)", borderRadius: 12, padding: "0.75rem", fontFamily: "var(--font-mono)", fontSize: "0.72rem", lineHeight: 1.45 }}>
          <div>index: {paused ? activeIndex : autoIndex} / {loopLength}</div>
          <div>loop: {activeLoop}</div>
          <div>featured: {activeItem.featuredInstitution?.displayName ?? "fallback"}</div>
          <div>project: {activeProject?.projectTitle ?? activeProject?.teamName}</div>
          <div>reason: {activeItem.reason}</div>
        </div>
      )}

      <div
        className="presentation-footer"
        style={{
          position: "fixed",
          left: 18,
          right: 18,
          bottom: 18,
          zIndex: 4,
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-start",
          pointerEvents: "none",
          color: "var(--color-subtle)",
          fontSize: "0.78rem",
          fontWeight: 800,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          opacity: cardsVisible ? 0 : 0.8,
          transition: "opacity 300ms ease",
        }}
      >
        © 2026 Vibe Hackathon
      </div>
      <div
        className="presentation-controls"
        style={{
          position: "fixed",
          right: 18,
          bottom: 18,
          zIndex: 4,
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          opacity: controlsVisible || paused ? 1 : 0,
          transition: "opacity 300ms ease",
        }}
      >
        {paused && <span className="badge badge-warning">Paused</span>}
        <button className="btn-secondary" type="button" onClick={() => setPaused((value) => !value)} title="Space: pause or resume" aria-label={paused ? "Resume presentation. Space" : "Pause presentation. Space"} style={{ minWidth: 44, padding: "0.55rem 0.7rem" }}>
          {paused ? "▶" : "⏸"} <span style={{ color: "var(--color-subtle)", fontSize: "0.72rem", marginLeft: 4 }}>Space</span>
        </button>
        <button className="btn-secondary" type="button" onClick={() => document.documentElement.requestFullscreen?.()} title="F: fullscreen" aria-label="Fullscreen. F" style={{ minWidth: 44, padding: "0.55rem 0.7rem" }}>
          ⛶ <span style={{ color: "var(--color-subtle)", fontSize: "0.72rem", marginLeft: 4 }}>F</span>
        </button>
      </div>
    </main>
  );
}

function ProjectSpotlightCard({ project }: { project: PresentationProject }) {
  const [origin, setOrigin] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const projectPath = `/project/${project.id}`;
  const projectUrl = origin ? `${origin}${projectPath}` : projectPath;

  useEffect(() => {
    if (!origin || !project.id) {
      setQrDataUrl(null);
      return;
    }

    let cancelled = false;
    QRCode.toDataURL(projectUrl, {
      errorCorrectionLevel: "M",
      margin: 1,
      scale: 7,
      color: {
        dark: "#050914",
        light: "#ffffff",
      },
    })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl(null);
      });

    return () => {
      cancelled = true;
    };
  }, [origin, project.id, projectUrl]);

  return (
    <section
      style={{
        border: "1px solid rgba(255,255,255,0.14)",
        background: "linear-gradient(145deg, rgba(11,18,31,0.91), rgba(7,11,20,0.74))",
        boxShadow: "0 28px 90px rgba(0,0,0,0.42)",
        borderRadius: 32,
        overflow: "hidden",
        backdropFilter: "blur(18px)",
      }}
      aria-label="Project spotlight"
    >
      <div style={{ height: "clamp(190px, 30vh, 350px)", background: "rgba(255,255,255,0.045)", position: "relative" }}>
        {project.screenshotUrl ? (
          <img src={project.screenshotUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", opacity: 0.88 }} />
        ) : (
          <div style={{ height: "100%", display: "grid", placeItems: "center", color: "var(--color-subtle)", fontWeight: 900, fontSize: "clamp(1.1rem, 2vw, 1.6rem)", background: "radial-gradient(circle at 50% 35%, rgba(255,255,255,0.08), transparent 48%)" }}>Project preview in progress</div>
        )}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, transparent 40%, rgba(4,7,13,0.9))" }} />
        <div style={{ position: "absolute", left: "1.25rem", right: "1.25rem", bottom: "1.15rem" }}>
          <AwardBadges badges={project.awards} prominence="prominent" />
        </div>
        {project.isInProgress && (
          <div className="badge badge-warning" style={{ position: "absolute", top: "1rem", left: "1rem", fontSize: "0.78rem", padding: "0.42rem 0.7rem", fontWeight: 900, letterSpacing: "0.08em" }}>
            IN PROGRESS
          </div>
        )}
      </div>
      <div style={{ padding: "clamp(0.95rem, 2vw, 1.65rem)" }}>
        <div style={{ color: "var(--color-accent)", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.16em", fontWeight: 900, marginBottom: "0.5rem" }}>Project Spotlight</div>
        <h1 style={{ fontFamily: "var(--font-headline)", color: "var(--color-fg)", fontSize: "clamp(1.85rem, 4.45vw, 4.25rem)", fontWeight: 950, letterSpacing: "-0.07em", lineHeight: 0.9 }}>
          {project.projectTitle ?? project.teamName}
        </h1>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: "clamp(0.8rem, 1.6vw, 1.25rem)", alignItems: "end", marginTop: "0.85rem" }}>
          <div>
            <p style={{ color: "var(--color-muted)", fontSize: "clamp(0.95rem, 1.45vw, 1.18rem)", lineHeight: 1.38, margin: 0, maxWidth: 900 }}>
              {project.problemStatement ?? "Project details are still being prepared."}
            </p>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.85rem" }}>
              {project.tags.map((tag) => <span key={tag} className="badge badge-default">{tag}</span>)}
              {project.demoUrl && <span className="badge badge-success">Demo</span>}
              {project.demoVideoUrl && <span className="badge badge-success">Video</span>}
              {project.githubUrl && <span className="badge badge-default">GitHub</span>}
              {project.audienceVotes !== null && <span className="badge badge-default">❤ {project.audienceVotes}</span>}
              {project.aiScore !== null && <span className="badge badge-default">AI {project.aiScore}/100</span>}
              <span className="badge badge-default">{projectPath}</span>
            </div>
          </div>
          {qrDataUrl && (
            <div
              className="presentation-qr"
              aria-label={`QR code for ${project.projectTitle ?? project.teamName}`}
              style={{
                width: "clamp(104px, 10vw, 148px)",
                height: "clamp(104px, 10vw, 148px)",
                display: "grid",
                justifyItems: "center",
                flexShrink: 0,
              }}
            >
              <div style={{ width: "100%", height: "100%", aspectRatio: "1 / 1", borderRadius: 18, background: "linear-gradient(145deg, rgba(255,255,255,0.96), rgba(210,223,235,0.92))", padding: 7, border: "1px solid rgba(255,255,255,0.5)", boxShadow: "0 14px 36px rgba(0,0,0,0.32), 0 0 0 1px rgba(255,255,255,0.08)" }}>
                <img src={qrDataUrl} alt="" style={{ width: "100%", height: "100%", aspectRatio: "1 / 1", objectFit: "contain", display: "block", borderRadius: 10 }} />
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
