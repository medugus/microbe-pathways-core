// Decorative science-themed watermark, tinted in orange.
// Floating microbiology motifs (petri dish, microscope, DNA helix, bacteria,
// flask, molecule) chosen per-route. Fixed, pointer-events disabled, low
// opacity — overlays every page without interfering with input.
// Respects prefers-reduced-motion via CSS.

import { useRouterState } from "@tanstack/react-router";

type Motif =
  | "petri"
  | "microscope"
  | "dna"
  | "bacteria"
  | "flask"
  | "molecule"
  | "virus"
  | "pill"
  | "chart"
  | "shield";

type Spec = {
  motif: Motif;
  top?: string;
  left?: string;
  right?: string;
  bottom?: string;
  size: number;
  delay: string;
  dur: string;
};

const PRIMARY = "var(--watermark-primary)";
const LIGHT = "var(--watermark-light)";
const DEEP = "var(--watermark-deep)";

function routeMotifs(path: string): Motif[] {
  if (path.startsWith("/ams")) return ["pill", "molecule", "flask"];
  if (path.startsWith("/ipc")) return ["shield", "virus", "bacteria"];
  if (path.startsWith("/analytics")) return ["chart", "molecule", "dna"];
  if (path.startsWith("/audit")) return ["shield", "chart", "molecule"];
  if (path.startsWith("/workspace")) return ["petri", "microscope", "bacteria"];
  if (path.startsWith("/admin")) return ["flask", "dna", "molecule"];
  if (
    path.startsWith("/login") ||
    path.startsWith("/signup") ||
    path.startsWith("/forgot-password") ||
    path.startsWith("/reset-password")
  )
    return ["dna", "molecule", "microscope"];
  // home / fallback
  return ["petri", "dna", "microscope", "bacteria"];
}

function buildSpecs(motifs: Motif[]): Spec[] {
  const slots: Omit<Spec, "motif">[] = [
    { top: "6%", left: "4%", size: 130, delay: "0s", dur: "9s" },
    { top: "18%", right: "7%", size: 92, delay: "1.4s", dur: "10s" },
    { top: "54%", left: "3%", size: 74, delay: "2.6s", dur: "11s" },
    { bottom: "10%", right: "6%", size: 150, delay: "0.7s", dur: "9.5s" },
    { bottom: "24%", left: "16%", size: 58, delay: "3.1s", dur: "12s" },
    { top: "40%", right: "22%", size: 46, delay: "1.9s", dur: "10.5s" },
  ];
  return slots.map((s, i) => ({ ...s, motif: motifs[i % motifs.length] }));
}

function Motif({ kind, size }: { kind: Motif; size: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 100 100",
    "aria-hidden": true,
    style: { display: "block" as const },
  };

  switch (kind) {
    case "petri":
      return (
        <svg {...common}>
          <circle cx="50" cy="50" r="42" fill="none" stroke={PRIMARY} strokeWidth="2.5" />
          <circle cx="50" cy="50" r="36" fill={LIGHT} opacity="0.35" />
          <circle cx="40" cy="44" r="4" fill={DEEP} />
          <circle cx="58" cy="38" r="2.5" fill={DEEP} />
          <circle cx="62" cy="56" r="5" fill={DEEP} />
          <circle cx="44" cy="62" r="3" fill={DEEP} />
          <circle cx="52" cy="50" r="1.5" fill={DEEP} />
          <circle cx="36" cy="54" r="2" fill={DEEP} />
        </svg>
      );
    case "microscope":
      return (
        <svg {...common}>
          <path
            d="M40 18 L60 18 L60 36 L52 40 L52 56 L48 56 L48 40 L40 36 Z"
            fill={PRIMARY}
          />
          <circle cx="50" cy="64" r="9" fill="none" stroke={PRIMARY} strokeWidth="3" />
          <rect x="30" y="78" width="40" height="6" rx="2" fill={DEEP} />
          <path d="M50 73 L50 78" stroke={PRIMARY} strokeWidth="3" />
          <path d="M62 26 L78 26 L78 42" stroke={PRIMARY} strokeWidth="2.5" fill="none" />
        </svg>
      );
    case "dna":
      return (
        <svg {...common}>
          <path
            d="M30 10 C 70 30, 30 50, 70 70 C 30 80, 70 90, 70 90"
            stroke={PRIMARY}
            strokeWidth="2.5"
            fill="none"
          />
          <path
            d="M70 10 C 30 30, 70 50, 30 70 C 70 80, 30 90, 30 90"
            stroke={DEEP}
            strokeWidth="2.5"
            fill="none"
          />
          {[20, 32, 44, 56, 68, 80].map((y, i) => (
            <line
              key={i}
              x1={32 + (i % 2) * 4}
              x2={68 - (i % 2) * 4}
              y1={y}
              y2={y}
              stroke={LIGHT}
              strokeWidth="2"
            />
          ))}
        </svg>
      );
    case "bacteria":
      return (
        <svg {...common}>
          <ellipse cx="35" cy="50" rx="14" ry="8" fill={PRIMARY} />
          <ellipse cx="60" cy="42" rx="16" ry="9" fill={LIGHT} />
          <ellipse cx="62" cy="64" rx="12" ry="7" fill={DEEP} />
          <path d="M22 50 q -6 -4 -8 -10" stroke={PRIMARY} strokeWidth="2" fill="none" />
          <path d="M76 42 q 8 -2 12 -8" stroke={LIGHT} strokeWidth="2" fill="none" />
          <path d="M74 64 q 8 4 12 10" stroke={DEEP} strokeWidth="2" fill="none" />
        </svg>
      );
    case "flask":
      return (
        <svg {...common}>
          <path
            d="M42 16 L42 38 L26 76 Q 22 88, 34 88 L66 88 Q 78 88, 74 76 L58 38 L58 16 Z"
            fill="none"
            stroke={PRIMARY}
            strokeWidth="2.5"
          />
          <path
            d="M30 70 Q 50 60, 70 70 L72 78 Q 50 84, 28 78 Z"
            fill={LIGHT}
            opacity="0.7"
          />
          <line x1="38" y1="16" x2="62" y2="16" stroke={DEEP} strokeWidth="3" strokeLinecap="round" />
          <circle cx="44" cy="74" r="1.5" fill={DEEP} />
          <circle cx="56" cy="76" r="1" fill={DEEP} />
        </svg>
      );
    case "molecule":
      return (
        <svg {...common}>
          <line x1="50" y1="50" x2="22" y2="28" stroke={PRIMARY} strokeWidth="2" />
          <line x1="50" y1="50" x2="80" y2="28" stroke={PRIMARY} strokeWidth="2" />
          <line x1="50" y1="50" x2="22" y2="76" stroke={PRIMARY} strokeWidth="2" />
          <line x1="50" y1="50" x2="80" y2="76" stroke={PRIMARY} strokeWidth="2" />
          <circle cx="50" cy="50" r="9" fill={DEEP} />
          <circle cx="22" cy="28" r="6" fill={LIGHT} />
          <circle cx="80" cy="28" r="6" fill={LIGHT} />
          <circle cx="22" cy="76" r="6" fill={PRIMARY} />
          <circle cx="80" cy="76" r="6" fill={PRIMARY} />
        </svg>
      );
    case "virus":
      return (
        <svg {...common}>
          <circle cx="50" cy="50" r="22" fill={PRIMARY} opacity="0.85" />
          {Array.from({ length: 10 }).map((_, i) => {
            const a = (i / 10) * Math.PI * 2;
            const x1 = 50 + Math.cos(a) * 22;
            const y1 = 50 + Math.sin(a) * 22;
            const x2 = 50 + Math.cos(a) * 36;
            const y2 = 50 + Math.sin(a) * 36;
            return (
              <g key={i}>
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={DEEP} strokeWidth="2" />
                <circle cx={x2} cy={y2} r="3" fill={LIGHT} />
              </g>
            );
          })}
          <circle cx="44" cy="46" r="3" fill={DEEP} />
          <circle cx="56" cy="54" r="2.5" fill={DEEP} />
        </svg>
      );
    case "pill":
      return (
        <svg {...common}>
          <g transform="rotate(35 50 50)">
            <rect x="18" y="40" width="64" height="20" rx="10" fill={LIGHT} />
            <rect x="18" y="40" width="32" height="20" rx="10" fill={PRIMARY} />
            <line x1="50" y1="40" x2="50" y2="60" stroke={DEEP} strokeWidth="2" />
          </g>
        </svg>
      );
    case "chart":
      return (
        <svg {...common}>
          <line x1="18" y1="82" x2="82" y2="82" stroke={DEEP} strokeWidth="2" />
          <line x1="18" y1="18" x2="18" y2="82" stroke={DEEP} strokeWidth="2" />
          <rect x="26" y="56" width="10" height="26" fill={LIGHT} />
          <rect x="42" y="40" width="10" height="42" fill={PRIMARY} />
          <rect x="58" y="48" width="10" height="34" fill={DEEP} />
          <polyline
            points="26,52 42,36 58,44 78,28"
            fill="none"
            stroke={PRIMARY}
            strokeWidth="2"
          />
        </svg>
      );
    case "shield":
      return (
        <svg {...common}>
          <path
            d="M50 12 L82 22 L82 50 Q 82 76, 50 88 Q 18 76, 18 50 L18 22 Z"
            fill={LIGHT}
            opacity="0.6"
            stroke={PRIMARY}
            strokeWidth="2.5"
          />
          <path
            d="M36 50 L46 60 L66 38"
            stroke={DEEP}
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
  }
}

export function PoppingOrangesWatermark() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const specs = buildSpecs(routeMotifs(path));

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      style={{ contain: "strict" }}
    >
      {specs.map((s, i) => (
        <div
          key={`${path}-${i}`}
          className="orange-pop absolute"
          style={{
            top: s.top,
            left: s.left,
            right: s.right,
            bottom: s.bottom,
            animationDelay: s.delay,
            animationDuration: s.dur,
            opacity: "var(--watermark-opacity)",
            filter: "drop-shadow(0 6px 14px rgba(217,119,6,0.35))",
          }}
        >
          <Motif kind={s.motif} size={s.size} />
        </div>
      ))}
    </div>
  );
}
