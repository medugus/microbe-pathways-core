// Decorative watermark: floating "popping" oranges + subtle botanical accents.
// Fixed, pointer-events disabled, low opacity — overlays every page without
// interfering with input. Respects prefers-reduced-motion via CSS.

type OrangeSpec = {
  top?: string;
  left?: string;
  right?: string;
  bottom?: string;
  size: number;
  delay: string;
  dur: string;
};

const ORANGES: OrangeSpec[] = [
  { top: "6%", left: "4%", size: 110, delay: "0s", dur: "7s" },
  { top: "18%", right: "8%", size: 78, delay: "1.2s", dur: "8s" },
  { top: "52%", left: "2%", size: 60, delay: "2.4s", dur: "9s" },
  { bottom: "10%", right: "5%", size: 130, delay: "0.6s", dur: "7.5s" },
  { bottom: "22%", left: "14%", size: 48, delay: "3s", dur: "10s" },
  { top: "38%", right: "22%", size: 38, delay: "1.8s", dur: "8.5s" },
];

function Orange({ size }: { size: number }) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      aria-hidden
      style={{ display: "block" }}
    >
      <defs>
        <radialGradient id="og" cx="35%" cy="32%" r="70%">
          <stop offset="0%" stopColor="#FDBA74" />
          <stop offset="55%" stopColor="#D97706" />
          <stop offset="100%" stopColor="#7C2D12" />
        </radialGradient>
      </defs>
      <circle cx="50" cy="52" r="42" fill="url(#og)" />
      {/* peel highlight */}
      <ellipse cx="36" cy="36" rx="10" ry="6" fill="#FFF7ED" opacity="0.55" />
      {/* leaf */}
      <path
        d="M50 12 C 60 4, 78 6, 80 18 C 70 22, 58 22, 50 16 Z"
        fill="#1B4D3E"
      />
      <path d="M52 14 Q 66 14, 78 18" stroke="#0F3D2E" strokeWidth="1" fill="none" />
      {/* stem */}
      <path d="M50 14 L 50 20" stroke="#3D2914" strokeWidth="2" strokeLinecap="round" />
      {/* dimple pores */}
      <circle cx="58" cy="48" r="1.2" fill="#7C2D12" opacity="0.4" />
      <circle cx="44" cy="62" r="1" fill="#7C2D12" opacity="0.4" />
      <circle cx="64" cy="68" r="1.1" fill="#7C2D12" opacity="0.4" />
    </svg>
  );
}

export function PoppingOrangesWatermark() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      style={{ contain: "strict" }}
    >
      {ORANGES.map((o, i) => (
        <div
          key={i}
          className="orange-pop absolute"
          style={{
            top: o.top,
            left: o.left,
            right: o.right,
            bottom: o.bottom,
            animationDelay: o.delay,
            animationDuration: o.dur,
            opacity: 0.13,
            filter: "drop-shadow(0 6px 14px rgba(217,119,6,0.35))",
          }}
        >
          <Orange size={o.size} />
        </div>
      ))}
    </div>
  );
}
