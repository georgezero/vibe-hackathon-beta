"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { InstitutionRow, GeoLocation } from "@/lib/event-status";
import type { EventHub } from "@/lib/institution-geo";
import type { Globe, Marker } from "cobe";

interface GeoInst extends InstitutionRow { geo: GeoLocation }

interface Props {
  institutions: InstitutionRow[];
  hub: EventHub;
  fullscreen?: boolean;
}

const GLOBE_THETA = 0.22;
const LIMB_DEPTH_CUTOFF = 0.22;

function hashName(value: string): number {
  let h = 0;
  for (const c of value) h = (Math.imul(31, h) + c.charCodeAt(0)) | 0;
  return Math.abs(h);
}

function toCobeVector(lat: number, lng: number): [number, number, number] {
  const latRad = lat * Math.PI / 180;
  const lngRad = lng * Math.PI / 180 - Math.PI;
  const cosLat = Math.cos(latRad);
  return [
    -cosLat * Math.cos(lngRad),
    Math.sin(latRad),
    cosLat * Math.sin(lngRad),
  ];
}

function frontFacingDepth(lat: number, lng: number, phi: number): number {
  const [x, y, z] = toCobeVector(lat, lng);
  const sinPhi = Math.sin(phi);
  const cosPhi = Math.cos(phi);
  const sinTheta = Math.sin(GLOBE_THETA);
  const cosTheta = Math.cos(GLOBE_THETA);
  return -sinPhi * cosTheta * x + sinTheta * y + cosPhi * cosTheta * z;
}

function isFrontFacing(lat: number, lng: number, phi: number): boolean {
  return frontFacingDepth(lat, lng, phi) > LIMB_DEPTH_CUTOFF;
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return reduced;
}

export default function ParticipationGlobe({ institutions, hub, fullscreen = false }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 720, height: 420 });
  const reducedMotion = useReducedMotion();
  const phiRef = useRef(-0.85);
  const lastFrameRef = useRef<number | null>(null);
  const dragRef = useRef({ active: false, lastX: 0 });
  const resumeTimerRef = useRef<number | null>(null);
  const pausedUntilRef = useRef(0);

  const geoInsts = useMemo(() => institutions.filter((i): i is GeoInst => !!i.geo), [institutions]);
  const maxParticipants = useMemo(() => Math.max(...geoInsts.map((i) => i.participants), 1), [geoInsts]);
  const markerSourceRef = useRef({ geoInsts, maxParticipants, hub });

  useEffect(() => {
    markerSourceRef.current = { geoInsts, maxParticipants, hub };
  }, [geoInsts, maxParticipants, hub]);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const observer = new ResizeObserver(([entry]) => {
      const rect = entry.contentRect;
      setSize({ width: Math.max(320, rect.width), height: Math.max(260, rect.height) });
    });

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let destroyed = false;
    let globe: Globe | null = null;
    let animationFrame = 0;
    const canvasEl = canvas;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.floor(size.width * dpr);
    const height = Math.floor(size.height * dpr);
    const globeSize = Math.floor(Math.min(width, height) * (fullscreen ? 0.92 : 0.96));

    canvas.width = width;
    canvas.height = height;

    async function init() {
      const mod = await import("cobe");
      if (destroyed) return;

      globe = mod.default(canvasEl, {
        devicePixelRatio: dpr,
        width,
        height,
        phi: phiRef.current,
        theta: GLOBE_THETA,
        dark: 1,
        diffuse: 1.15,
        mapSamples: 16000,
        mapBrightness: 1.6,
        baseColor: [0.07, 0.1, 0.15],
        markerColor: [0.96, 0.55, 0.22],
        glowColor: [0.22, 0.34, 0.52],
        opacity: 0.96,
        offset: [0, 0],
        scale: globeSize / Math.min(width, height),
        markerElevation: 0,
        markers: [],
      });

      function tick() {
        if (destroyed || !globe) return;

        const now = performance.now();
        const last = lastFrameRef.current ?? now;
        const dt = Math.min(64, now - last) / 1000;
        lastFrameRef.current = now;

        if (!reducedMotion && !dragRef.current.active && now >= pausedUntilRef.current) {
          const secondsPerRev = fullscreen ? 170 : 105;
          phiRef.current += (Math.PI * 2 / secondsPerRev) * dt;
        }

        const { geoInsts: currentInsts, maxParticipants: currentMax, hub: currentHub } = markerSourceRef.current;
        const pulseBase = reducedMotion ? 1 : 1 + Math.sin(now / 1150) * 0.18;
        const markers: Marker[] = currentInsts.flatMap((inst) => {
          if (!isFrontFacing(inst.geo.lat, inst.geo.lng, phiRef.current)) return [];
          const h = hashName(inst.name);
          const stagger = reducedMotion ? 1 : 1 + Math.sin(now / 1300 + (h % 628) / 100) * 0.24;
          return [{
            location: [inst.geo.lat, inst.geo.lng],
            size: (0.035 + (inst.participants / currentMax) * 0.035) * stagger,
          }];
        });

        if (isFrontFacing(currentHub.lat, currentHub.lng, phiRef.current)) {
          markers.push({
            location: [currentHub.lat, currentHub.lng],
            size: 0.085 * pulseBase,
            color: [1, 0.72, 0.35],
          });
        }

        globe.update({ phi: phiRef.current, markers });
        animationFrame = window.requestAnimationFrame(tick);
      }

      tick();
    }

    init();

    return () => {
      destroyed = true;
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      globe?.destroy();
      globe = null;
      lastFrameRef.current = null;
    };
  }, [fullscreen, reducedMotion, size.height, size.width]);

  useEffect(() => {
    return () => {
      if (resumeTimerRef.current) window.clearTimeout(resumeTimerRef.current);
    };
  }, []);

  function pauseAfterInteraction() {
    pausedUntilRef.current = performance.now() + 5000;
    if (resumeTimerRef.current) window.clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = window.setTimeout(() => {
      pausedUntilRef.current = 0;
    }, 5000);
  }

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: fullscreen ? "100%" : "clamp(300px, 43vw, 475px)",
        position: "relative",
        overflow: "hidden",
        borderRadius: fullscreen ? 18 : 6,
        background: "radial-gradient(circle at 50% 44%, rgba(24, 43, 70, 0.74), rgba(4, 8, 14, 0.98) 58%, rgba(2, 4, 9, 1) 100%)",
        cursor: dragRef.current.active ? "grabbing" : "grab",
      }}
    >
      <canvas
        ref={canvasRef}
        aria-label="Institution participation globe"
        style={{ width: "100%", height: "100%", display: "block" }}
        onPointerDown={(event) => {
          dragRef.current = { active: true, lastX: event.clientX };
          pausedUntilRef.current = Number.POSITIVE_INFINITY;
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!dragRef.current.active) return;
          const dx = event.clientX - dragRef.current.lastX;
          dragRef.current.lastX = event.clientX;
          phiRef.current += dx / 190;
        }}
        onPointerUp={(event) => {
          dragRef.current.active = false;
          event.currentTarget.releasePointerCapture(event.pointerId);
          pauseAfterInteraction();
        }}
        onPointerCancel={() => {
          dragRef.current.active = false;
          pauseAfterInteraction();
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: "8% 14% 10% 14%",
          borderRadius: "999px",
          pointerEvents: "none",
          boxShadow: "0 0 80px rgba(82, 126, 180, 0.18), inset 0 0 70px rgba(255,255,255,0.025)",
        }}
      />
    </div>
  );
}
