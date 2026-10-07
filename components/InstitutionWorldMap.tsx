"use client";

import { useEffect, useState } from "react";
import type { InstitutionRow, GeoLocation } from "@/lib/event-status";
import type { EventHub } from "@/lib/institution-geo";

// ── Projection (equirectangular, 960×480) ─────────────────────────────────────

export const WORLD_MAP_W = 960;
export const WORLD_MAP_H = 480;

export function worldMapPx(lng: number, lat: number): [number, number] {
  return [(lng + 180) / 360 * WORLD_MAP_W, (90 - lat) / 180 * WORLD_MAP_H];
}

function nameHash(s: string): number {
  let h = 0;
  for (const c of s) h = (Math.imul(31, h) + c.charCodeAt(0)) | 0;
  return Math.abs(h);
}

// ── Land polygons ─────────────────────────────────────────────────────────────
// Simplified from Natural Earth 110m (public domain, naturalearthdata.com).
// Projected with equirectangular to match 960×480 viewBox.

const LAND: { name: string; pts: [number, number][] }[] = [
  {
    name: "North America",
    pts: [
      [-168, 72], [-163, 61], [-152, 58], [-140, 60], [-134, 57], [-131, 54],
      [-126, 50], [-124, 47], [-124, 37], [-122, 37], [-118, 34], [-117, 32],
      [-116, 32], [-110, 23], [-105, 20], [-92, 17], [-88, 16], [-84, 10],
      [-83, 9], [-79, 9], [-77, 9], [-77, 25], [-80, 26], [-81, 25],
      [-81, 24], [-80, 25], [-80, 27], [-80, 31], [-81, 32], [-80, 32],
      [-80, 33], [-79, 34], [-77, 35], [-76, 36], [-75, 37], [-76, 38],
      [-75, 39], [-74, 40], [-74, 41], [-72, 41], [-70, 43], [-70, 44],
      [-67, 45], [-65, 44], [-63, 44], [-61, 46], [-60, 47], [-65, 49],
      [-67, 47], [-70, 47], [-73, 46], [-77, 44], [-79, 44], [-82, 43],
      [-83, 42], [-86, 43], [-88, 43], [-88, 45], [-90, 47], [-92, 48],
      [-97, 49], [-100, 49], [-110, 49], [-120, 49], [-127, 50], [-140, 60],
      [-156, 60],
    ],
  },
  {
    name: "Greenland",
    pts: [
      [-17, 82], [-15, 76], [-18, 72], [-25, 68], [-44, 62],
      [-52, 66], [-58, 68], [-65, 76], [-52, 83], [-30, 84],
    ],
  },
  {
    name: "South America",
    pts: [
      [-78, 13], [-75, 11], [-70, 12], [-63, 10], [-61, 8], [-57, 6],
      [-50, 4], [-50, 0], [-48, -3], [-38, -6], [-35, -9], [-37, -15],
      [-39, -23], [-44, -23], [-47, -24], [-48, -28], [-51, -33],
      [-53, -34], [-58, -38], [-62, -40], [-65, -46], [-68, -54],
      [-70, -52], [-75, -50], [-78, -45], [-72, -30], [-70, -18],
      [-77, -8], [-80, -2], [-78, 3], [-78, 9],
    ],
  },
  {
    name: "Europe",
    pts: [
      // Atlantic coast: Portugal → France
      [-10, 36], [-9, 39], [-9, 44], [-1, 44], [3, 44],
      // Channel / North Sea
      [3, 51], [2, 51], [0, 50], [-2, 49], [-5, 48],
      [-6, 47], [-1, 44],
      // Re-enter from Bay of Biscay → Mediterranean
      [3, 44], [7, 44], [12, 44], [13, 44], [13, 46], [15, 46],
      // Adriatic / Balkans
      [15, 43], [20, 42], [25, 41], [28, 37], [35, 37], [36, 37],
      // Black Sea coast → East Europe
      [40, 38], [42, 41], [47, 48], [44, 51],
      // Baltic states → Scandinavia up
      [33, 57], [26, 60], [22, 60], [18, 58], [14, 58], [10, 58],
      [5, 58], [5, 62], [7, 65], [14, 67], [16, 70], [26, 71],
      // Scandinavia back down
      [30, 69], [28, 65], [26, 62], [29, 59], [22, 57],
      // Baltic coast → Germany/Denmark
      [20, 54], [14, 54], [10, 55], [8, 56],
      // Rejoin North Sea → close
      [5, 58], [3, 51],
    ],
  },
  {
    name: "Africa",
    pts: [
      [-16, 21], [-16, 16], [-14, 11], [-16, 7], [-15, 5],
      [-10, 5], [-8, 4], [0, 4], [9, 1], [10, 0],
      [15, -5], [25, -8], [32, -10], [35, -12], [40, -11],
      [41, -2], [41, 12], [43, 12], [43, 15], [40, 20],
      [37, 22], [34, 28], [32, 30], [36, 35], [32, 37],
      [25, 37], [13, 37], [8, 37], [0, 34], [-5, 34],
      [-12, 37], [-14, 33], [-16, 26],
    ],
  },
  {
    name: "Asia",
    pts: [
      // West edge (Europe/Asia boundary) → Middle East → India → SE Asia → Pacific coast → Arctic
      [26, 70], [28, 37], [35, 37], [36, 37], [40, 38], [40, 40],
      [42, 41], [47, 48], [50, 52], [55, 55], [60, 55],
      [65, 55], [70, 55], [78, 52], [88, 50], [100, 50],
      [105, 52], [110, 53], [120, 52], [130, 42], [135, 35],
      // Korean peninsula
      [126, 35], [128, 34], [129, 35], [128, 37], [130, 38],
      [128, 38], [126, 36], [125, 37],
      // Back to Japan-side coast
      [130, 34], [131, 32], [130, 31],
      // SE Asia coast
      [120, 20], [122, 18], [120, 14], [121, 14], [124, 11],
      [125, 8], [124, 6], [120, 4], [116, 2], [110, 1],
      [108, -1], [108, 2], [104, 1], [104, 10],
      [100, 13], [98, 18], [100, 20], [98, 23],
      // India (detour south)
      [92, 22], [88, 22], [80, 28], [77, 28], [73, 22],
      [72, 20], [76, 10], [78, 8], [80, 10], [80, 14],
      [82, 22], [85, 22], [88, 24], [92, 22],
      // Back to Persian Gulf / Arabian Peninsula (minimal)
      [60, 22], [55, 23], [50, 22], [43, 15], [41, 12],
      // Red Sea / Horn of Africa side already covered by Africa
      // Back through Middle East
      [38, 30], [35, 31], [35, 37], [28, 37], [26, 70],
    ],
  },
  {
    name: "Australia",
    pts: [
      [113, -22], [114, -26], [114, -32], [118, -34], [122, -34],
      [124, -34], [127, -33], [130, -33], [133, -34], [137, -35],
      [140, -36], [145, -38], [147, -38], [150, -36], [152, -30],
      [152, -25], [150, -23], [148, -20], [145, -15], [140, -17],
      [136, -12], [131, -12], [128, -14], [124, -15], [122, -18],
      [115, -21],
    ],
  },
];

const ISLANDS: { name: string; pts: [number, number][] }[] = [
  {
    name: "UK",
    pts: [
      [-3, 51], [-5, 50], [-5, 52], [-3, 54], [-5, 55],
      [-2, 58], [0, 58], [2, 57], [2, 53], [1, 51],
    ],
  },
  {
    name: "Ireland",
    pts: [[-10, 51], [-10, 54], [-7, 55], [-6, 52], [-8, 51]],
  },
  {
    name: "Iceland",
    pts: [[-24, 63], [-14, 63], [-12, 65], [-18, 66], [-24, 65]],
  },
  {
    name: "Japan",
    pts: [
      [131, 31], [130, 33], [131, 34], [133, 34], [135, 34],
      [137, 35], [137, 37], [137, 36], [140, 36], [141, 38],
      [141, 40], [142, 40], [140, 41], [140, 43], [141, 43],
      [141, 44], [143, 44], [145, 43], [145, 43], [143, 42],
      [141, 40], [142, 37], [141, 35], [138, 34], [136, 34],
      [135, 33], [133, 33], [132, 32],
    ],
  },
  {
    name: "New Zealand North",
    pts: [
      [172, -37], [174, -36], [178, -37], [178, -38],
      [176, -39], [173, -39], [172, -38],
    ],
  },
  {
    name: "New Zealand South",
    pts: [
      [166, -46], [168, -46], [170, -44], [171, -43],
      [172, -43], [171, -45], [168, -47], [166, -47],
    ],
  },
  {
    name: "Madagascar",
    pts: [
      [44, -12], [50, -14], [50, -16], [50, -20],
      [47, -25], [44, -25], [43, -22], [44, -18], [44, -14],
    ],
  },
  {
    name: "Sri Lanka",
    pts: [[80, 10], [81, 8], [81, 7], [80, 7], [80, 8]],
  },
  {
    name: "Borneo",
    pts: [
      [108, 1], [116, 1], [118, 4], [118, 7],
      [115, 7], [112, 4], [108, 1],
    ],
  },
  {
    name: "Sumatra",
    pts: [
      [95, 5], [104, 1], [106, -6], [104, -6],
      [100, -3], [96, 3],
    ],
  },
  {
    name: "Philippines",
    pts: [
      [119, 18], [122, 18], [124, 15], [124, 12],
      [122, 10], [120, 12], [119, 16],
    ],
  },
];

interface LandDot {
  id: string;
  x: number;
  y: number;
  r: number;
  opacity: number;
}

function pointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
  const [lng, lat] = point;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const intersects = yi > lat !== yj > lat
      && lng < ((xj - xi) * (lat - yi)) / (yj - yi || 1e-9) + xi;
    if (intersects) inside = !inside;
  }

  return inside;
}

function makeWorldDots(): LandDot[] {
  const dots: LandDot[] = [];
  const masks = [...LAND, ...ISLANDS];
  const step = 2.65;

  for (const mask of masks) {
    const lngs = mask.pts.map(([lng]) => lng);
    const lats = mask.pts.map(([, lat]) => lat);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);

    for (let lng = minLng; lng <= maxLng; lng += step) {
      for (let lat = minLat; lat <= maxLat; lat += step) {
        const h = nameHash(`${mask.name}:${lng.toFixed(2)}:${lat.toFixed(2)}`);
        const jitterLng = ((h % 1000) / 1000 - 0.5) * step * 0.18;
        const jitterLat = (((Math.floor(h / 1000) % 1000) / 1000) - 0.5) * step * 0.18;
        const point: [number, number] = [lng + step / 2 + jitterLng, lat + step / 2 + jitterLat];

        if (!pointInPolygon(point, mask.pts)) continue;

        const [x, y] = worldMapPx(point[0], point[1]);
        dots.push({
          id: `${mask.name}-${dots.length}`,
          x,
          y,
          r: 1.05,
          opacity: 0.13 + ((Math.floor(h / 10_000) % 1000) / 1000) * 0.16,
        });
      }
    }
  }

  return dots;
}

export const WORLD_DOTS = makeWorldDots();

// ── Component ─────────────────────────────────────────────────────────────────

interface GeoInst extends InstitutionRow { geo: GeoLocation }

interface TooltipState { x: number; y: number; inst: GeoInst }

interface Props {
  institutions: InstitutionRow[];
  hub: EventHub;
  expanded?: boolean;
  hideFullscreenButton?: boolean;
}

export function InstitutionWorldMap({ institutions, hub, expanded = false, hideFullscreenButton = false }: Props) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  const geoInsts = institutions.filter((i): i is GeoInst => !!i.geo);
  const [hx, hy] = worldMapPx(hub.lng, hub.lat);
  const maxPart = Math.max(...geoInsts.map((i) => i.participants), 1);
  useEffect(() => {
    function isTypingTarget(target: EventTarget | null): boolean {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName.toLowerCase();
      return tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (isTypingTarget(event.target)) return;
      if (event.key === "Escape") {
        setFullscreen(false);
        return;
      }
      if (!hideFullscreenButton && event.key.toLowerCase() === "f" && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        setFullscreen((value) => !value);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [hideFullscreenButton]);

  function handleMove(e: React.MouseEvent<SVGElement>, inst: GeoInst) {
    const svg = e.currentTarget.closest("svg") as SVGSVGElement;
    const rect = svg.getBoundingClientRect();
    const sx = ((e.clientX - rect.left) / rect.width) * WORLD_MAP_W;
    const sy = ((e.clientY - rect.top) / rect.height) * WORLD_MAP_H;
    setTooltip({ x: sx, y: sy, inst });
  }

  if (geoInsts.length === 0) {
    return (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        height: "100%", minHeight: 220, color: "var(--color-muted)",
        fontSize: "0.875rem", textAlign: "center", padding: "1.5rem",
      }}>
        Location dots will appear as institution affiliations are recognized.
      </div>
    );
  }

  function renderMap(expanded = false) {
    return (
    <svg
      viewBox={`18 28 924 410`}
      preserveAspectRatio="xMidYMid meet"
      style={{
        width: "100%",
        height: expanded ? "100%" : "auto",
        display: "block",
        borderRadius: expanded ? 14 : 6,
        background: "rgba(4, 8, 14, 0.96)",
      }}
      onMouseLeave={() => setTooltip(null)}
      aria-label="Institution world map"
    >
      <style>{`
        .wm-fullscreen-fill {
          transform-origin: 50% 50%;
          transform: scale(1.08);
        }
        @keyframes wm-pulse-ring {
          0%   { opacity: 0;    transform: scale(0.9); }
          18%  { opacity: 0.24; transform: scale(1); }
          100% { opacity: 0;    transform: scale(3.1); }
        }
        @keyframes wm-hub-ring {
          0%   { opacity: 0;    transform: scale(1); }
          20%  { opacity: 0.2;  transform: scale(1.12); }
          100% { opacity: 0;    transform: scale(4.8); }
        }
        @keyframes wm-hub-breathe {
          0%, 100% { opacity: 0.22; transform: scale(1); }
          50%      { opacity: 0.38; transform: scale(1.14); }
        }
        @media (prefers-reduced-motion: reduce) {
          .wm-pulse-ring   { animation: none !important; opacity: 0 !important; }
          .wm-hub-ring     { animation: none !important; opacity: 0 !important; }
          .wm-hub-breathe  { animation: none !important; opacity: 0.18 !important; }
        }
      `}</style>

      {/* Ocean */}
      <defs>
        <filter id="wm-soft-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="3.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <radialGradient id="wm-ocean" cx="54%" cy="48%" r="76%">
          <stop offset="0%" stopColor="rgba(17, 27, 42, 0.98)" />
          <stop offset="64%" stopColor="rgba(8, 13, 23, 0.98)" />
          <stop offset="100%" stopColor="rgba(3, 6, 12, 1)" />
        </radialGradient>
      </defs>
      <rect x={0} y={0} width={WORLD_MAP_W} height={WORLD_MAP_H} fill="url(#wm-ocean)" rx={6} />

      <g className={expanded ? "wm-fullscreen-fill" : undefined}>

      {/* Dot-matrix world field: masks are used only for deterministic point generation. */}
      <g aria-hidden="true">
        {WORLD_DOTS.map((dot) => (
          <circle
            key={dot.id}
            cx={dot.x}
            cy={dot.y}
            r={expanded ? dot.r * 1.04 : dot.r}
            fill="rgb(142, 162, 184)"
            opacity={dot.opacity}
          />
        ))}
      </g>

      {/* Institution dots */}
      {geoInsts.map((inst) => {
        const [cx, cy] = worldMapPx(inst.geo.lng, inst.geo.lat);
        const r = 3.5 + (inst.participants / maxPart) * 5;
        const isLow = inst.geo.confidence === "low";
        const h = nameHash(inst.name + "p");
        const pulseDur = ((h % 4000) + 4000) / 1000;
        const pulseDelay = (h % 8000) / 1000;
        return (
          <g
            key={`dot-${inst.name}`}
            style={{ cursor: "pointer" }}
            onMouseMove={(e) => handleMove(e, inst)}
            onMouseLeave={() => setTooltip(null)}
          >
            {/* Pulse ring */}
            <circle
              cx={cx} cy={cy} r={r * 1.5}
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth={0.65}
              className="wm-pulse-ring"
              style={{
                transformBox: "fill-box",
                transformOrigin: "center",
                animation: `wm-pulse-ring ${pulseDur}s ease-out ${pulseDelay}s infinite`,
              }}
            />
            {/* Halo */}
            <circle cx={cx} cy={cy} r={r * 2.1} fill="var(--color-accent)" opacity={0.055} filter="url(#wm-soft-glow)" />
            {/* Dot */}
            <circle
              cx={cx} cy={cy} r={r}
              fill="var(--color-accent)"
              opacity={isLow ? 0.38 : 0.68}
              stroke={isLow ? "var(--color-accent)" : "none"}
              strokeWidth={isLow ? 1 : 0}
              strokeDasharray={isLow ? "2 2" : undefined}
            />
          </g>
        );
      })}

      {/* Event hub */}
      <g>
        <circle
          cx={hx} cy={hy} r={17}
          fill="var(--color-accent)"
          className="wm-hub-breathe"
          style={{ transformBox: "fill-box", transformOrigin: "center", animation: "wm-hub-breathe 10s ease-in-out infinite" }}
        />
        <circle cx={hx} cy={hy} r={8.2} fill="var(--color-accent)" opacity={0.6} filter="url(#wm-soft-glow)" />
        <circle cx={hx} cy={hy} r={4.1} fill="white" opacity={0.84} />
        <title>{hub.city}{hub.region ? `, ${hub.region}` : ""} — Event Hub</title>
      </g>

      {/* Tooltip */}
      {tooltip && (() => {
        const { x, y, inst } = tooltip;
        const lines = [
          inst.name,
          `${inst.geo.confidence === "low" ? "~" : ""}${inst.geo.city}${inst.geo.region ? `, ${inst.geo.region}` : ""}, ${inst.geo.country}`,
          `${inst.teams} team${inst.teams !== 1 ? "s" : ""} · ${inst.participants} participant${inst.participants !== 1 ? "s" : ""}`,
        ];
        const tw = Math.max(...lines.map((l) => l.length)) * 6.2 + 20;
        const th = lines.length * 17 + 14;
        const tx = Math.min(x + 10, WORLD_MAP_W - tw - 4);
        const ty = Math.max(y - th - 6, 4);
        return (
          <g pointerEvents="none">
            <rect x={tx} y={ty} width={tw} height={th} rx={5} fill="rgba(8,8,14,0.92)" />
            {lines.map((line, i) => (
              <text
                key={i}
                x={tx + 10}
                y={ty + 13 + i * 17}
                fill={i === 0 ? "#F0F0F4" : "#8888A0"}
                fontSize={i === 0 ? 11 : 10}
                fontFamily="var(--font-sans, system-ui)"
                fontWeight={i === 0 ? 600 : 400}
              >
                {line}
              </text>
            ))}
          </g>
        );
      })()}
      </g>
    </svg>
    );
  }

  const mapSvg = renderMap(false);

  return (
    <div style={{ position: "relative" }}>
      {!hideFullscreenButton && (
        <button
          type="button"
          aria-label="Open map fullscreen"
          onClick={() => setFullscreen(true)}
          className="btn-ghost"
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            zIndex: 2,
            width: 34,
            height: 34,
            padding: 0,
            borderRadius: 10,
            background: "rgba(8, 12, 20, 0.72)",
            border: "1px solid rgba(255,255,255,0.12)",
            color: "var(--color-fg)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          ⛶
        </button>
      )}
      {expanded ? renderMap(true) : mapSvg}
      {!hideFullscreenButton && fullscreen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Institution map fullscreen"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            background: "rgba(2, 5, 10, 0.96)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "clamp(0.75rem, 2vw, 2rem)",
          }}
        >
          <button
            type="button"
            onClick={() => setFullscreen(false)}
            aria-label="Close fullscreen map"
            className="btn-secondary"
            style={{ position: "absolute", top: 16, right: 16, zIndex: 101 }}
          >
            Close · ESC
          </button>
          <div
            style={{
              position: "relative",
              width: "90vw",
              height: "85vh",
              overflow: "hidden",
              borderRadius: 18,
              border: "1px solid rgba(255,255,255,0.14)",
              boxShadow: "0 28px 90px rgba(0,0,0,0.55)",
              background: "rgba(4, 8, 14, 0.98)",
            }}
          >
            {renderMap(true)}
          </div>
        </div>
      )}
    </div>
  );
}
