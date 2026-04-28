export function StoryPathway() {
  return (
    <div className="pointer-events-none absolute inset-0 hidden md:block" aria-hidden>
      <svg className="h-full w-full" viewBox="0 0 920 420" fill="none">
        <defs>
          <linearGradient id="storyFlow" x1="70" y1="150" x2="840" y2="260" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="rgba(34,211,238,0.1)" />
            <stop offset="0.35" stopColor="rgba(45,212,191,0.45)" />
            <stop offset="0.7" stopColor="rgba(96,165,250,0.4)" />
            <stop offset="1" stopColor="rgba(16,185,129,0.35)" />
          </linearGradient>
          <linearGradient id="storyPulse" x1="70" y1="150" x2="840" y2="260" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="rgba(34,211,238,0.9)" />
            <stop offset="1" stopColor="rgba(16,185,129,0.95)" />
          </linearGradient>
        </defs>

        <path
          d="M70 150C160 150 180 210 260 210H410C500 210 525 128 620 128H745C790 128 810 210 850 210"
          stroke="url(#storyFlow)"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <path
          className="story-path-pulse"
          d="M70 150C160 150 180 210 260 210H410C500 210 525 128 620 128H745C790 128 810 210 850 210"
          stroke="url(#storyPulse)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="18 16"
        />

        {[{ x: 70, y: 150 }, { x: 280, y: 210 }, { x: 520, y: 160 }, { x: 850, y: 210 }].map((dot) => (
          <circle
            key={`${dot.x}-${dot.y}`}
            cx={dot.x}
            cy={dot.y}
            r="6"
            className="story-node-dot"
            fill="rgba(186,230,253,0.95)"
          />
        ))}
      </svg>
    </div>
  );
}
