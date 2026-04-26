import { StoryStage } from "@/auth/StoryStage";

const chips = [
  "Specimen integrity",
  "Culture & ID",
  "AST · EUCAST 2026",
  "IPC surveillance",
  "AMS stewardship",
] as const;

function SpecimenIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-8 w-8" fill="none" aria-hidden>
      <path d="M18 5h12v7l-3 5v17a4 4 0 0 1-8 0V17l-3-5V5z" stroke="rgba(186,230,253,1)" strokeWidth="2" strokeLinejoin="round" />
      <path d="M16 22h16" stroke="rgba(125,211,252,0.95)" strokeWidth="1.6" strokeLinecap="round" />
      <path className="report-tick" d="M19 31l3 3 6-7" stroke="rgba(52,211,153,1)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CultureIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-8 w-8" fill="none" aria-hidden>
      <path d="M10 28c4-10 10-14 14-14s10 4 14 14" stroke="rgba(186,230,253,1)" strokeWidth="2" strokeLinecap="round" />
      <path d="M8 36h32" stroke="rgba(125,211,252,0.9)" strokeWidth="2" strokeLinecap="round" />
      <circle cx="20" cy="22" r="2" fill="rgba(52,211,153,0.95)" />
      <circle cx="28" cy="20" r="1.7" fill="rgba(103,232,249,0.95)" />
      <circle cx="24" cy="26" r="1.6" fill="rgba(167,243,208,0.9)" />
      <path d="M24 14V8M24 8l-3 3M24 8l3 3" stroke="rgba(251,191,36,1)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function AstPanelIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-8 w-8" fill="none" aria-hidden>
      <rect x="7" y="9" width="34" height="30" rx="5" stroke="rgba(153,246,228,1)" strokeWidth="1.8" />
      <path d="M16 17H34M16 24H34M16 31H34" stroke="rgba(186,230,253,0.95)" strokeWidth="1.6" strokeLinecap="round" />
      <circle className="ast-cell" cx="13" cy="17" r="2.2" fill="rgba(52,211,153,1)" />
      <circle className="ast-cell" cx="13" cy="24" r="2.2" fill="rgba(251,191,36,1)" style={{ animationDelay: "0.8s" }} />
      <circle className="ast-cell" cx="13" cy="31" r="2.2" fill="rgba(248,113,113,1)" style={{ animationDelay: "1.6s" }} />
      <text x="36" y="19.5" fontSize="6" fontWeight="700" fill="rgba(52,211,153,1)" textAnchor="middle">S</text>
      <text x="36" y="26.5" fontSize="6" fontWeight="700" fill="rgba(251,191,36,1)" textAnchor="middle">I</text>
      <text x="36" y="33.5" fontSize="6" fontWeight="700" fill="rgba(248,113,113,1)" textAnchor="middle">R</text>
    </svg>
  );
}

function IpcShieldIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-8 w-8" fill="none" aria-hidden>
      <path d="M24 5l15 5v12c0 10-6 16-15 19-9-3-15-9-15-19V10l15-5z" stroke="rgba(191,219,254,1)" strokeWidth="2" strokeLinejoin="round" />
      <path className="report-tick" d="M17 24l4 4 9-10" stroke="rgba(52,211,153,1)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function AmsIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-8 w-8" fill="none" aria-hidden>
      <path d="M14 22l-4 4 4 4M34 22l4 4-4 4" stroke="rgba(186,230,253,1)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="18" y="14" width="12" height="20" rx="3" stroke="rgba(167,243,208,1)" strokeWidth="2" />
      <path d="M22 22h4M24 20v4" stroke="rgba(251,191,36,1)" strokeWidth="2" strokeLinecap="round" />
      <path className="report-tick" d="M21 28l2 2 4-4" stroke="rgba(52,211,153,1)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const stages = [
  { title: "Specimen", caption: "Right sample. Right tube. Right time.", tone: "specimen" as const, icon: <SpecimenIcon /> },
  { title: "Culture", caption: "Growth, morphology, organism ID — captured cleanly.", tone: "culture" as const, icon: <CultureIcon /> },
  { title: "AST", caption: "EUCAST-aligned S / I / R you can defend.", tone: "interpret" as const, icon: <AstPanelIcon /> },
  { title: "IPC", caption: "Outbreak signals surface in real time.", tone: "report" as const, icon: <IpcShieldIcon /> },
  { title: "AMS", caption: "The right antibiotic — sooner.", tone: "action" as const, icon: <AmsIcon /> },
];

type Bacterium = {
  kind: "coccus" | "diplococcus" | "rod" | "chain" | "spirochete" | "cluster";
  color: string;
  top: string;
  delay: string;
  duration: string;
  scale: number;
};

const bacteria: Bacterium[] = [
  { kind: "rod", color: "rgba(52,211,153,0.95)", top: "30%", delay: "0s", duration: "13s", scale: 1 },
  { kind: "cluster", color: "rgba(251,191,36,0.95)", top: "65%", delay: "2.2s", duration: "16s", scale: 1.1 },
  { kind: "diplococcus", color: "rgba(96,165,250,0.95)", top: "45%", delay: "4.5s", duration: "12s", scale: 0.9 },
  { kind: "spirochete", color: "rgba(167,243,208,0.9)", top: "20%", delay: "6.8s", duration: "18s", scale: 1 },
  { kind: "chain", color: "rgba(248,113,113,0.9)", top: "78%", delay: "9s", duration: "14s", scale: 0.95 },
  { kind: "coccus", color: "rgba(125,211,252,0.95)", top: "55%", delay: "11.5s", duration: "11s", scale: 0.85 },
];

function BacteriumShape({ kind, color }: { kind: Bacterium["kind"]; color: string }) {
  switch (kind) {
    case "coccus":
      return (
        <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none">
          <circle cx="10" cy="10" r="7" fill={color} />
          <circle cx="8" cy="8" r="2" fill="rgba(255,255,255,0.35)" />
        </svg>
      );
    case "diplococcus":
      return (
        <svg viewBox="0 0 32 18" className="h-3.5 w-6" fill="none">
          <circle cx="9" cy="9" r="7" fill={color} />
          <circle cx="23" cy="9" r="7" fill={color} />
          <circle cx="7" cy="7" r="1.6" fill="rgba(255,255,255,0.4)" />
          <circle cx="21" cy="7" r="1.6" fill="rgba(255,255,255,0.4)" />
        </svg>
      );
    case "rod":
      return (
        <svg viewBox="0 0 36 14" className="h-3 w-8" fill="none">
          <rect x="2" y="2" width="32" height="10" rx="5" fill={color} />
          <rect x="6" y="3.5" width="10" height="2" rx="1" fill="rgba(255,255,255,0.4)" />
        </svg>
      );
    case "chain":
      return (
        <svg viewBox="0 0 60 14" className="h-3 w-12" fill="none">
          {[7, 19, 31, 43, 55].map((cx) => (
            <circle key={cx} cx={cx} cy="7" r="5" fill={color} />
          ))}
        </svg>
      );
    case "spirochete":
      return (
        <svg viewBox="0 0 56 16" className="h-3 w-12" fill="none">
          <path
            d="M2 8 Q9 1 16 8 T30 8 T44 8 T54 8"
            stroke={color}
            strokeWidth="2.6"
            strokeLinecap="round"
            fill="none"
          />
        </svg>
      );
    case "cluster":
      return (
        <svg viewBox="0 0 28 22" className="h-4 w-5" fill="none">
          <circle cx="9" cy="9" r="5" fill={color} />
          <circle cx="18" cy="8" r="4.5" fill={color} />
          <circle cx="13" cy="15" r="4.5" fill={color} />
          <circle cx="20" cy="16" r="3.5" fill={color} />
        </svg>
      );
  }
}

function BacteriaFlow() {
  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-[60px] hidden h-12 overflow-hidden md:block"
      aria-hidden
    >
      {/* Faint guideline */}
      <svg className="absolute inset-x-0 top-1/2 h-1 w-full -translate-y-1/2" viewBox="0 0 1000 4" preserveAspectRatio="none" fill="none">
        <line
          x1="0"
          y1="2"
          x2="1000"
          y2="2"
          stroke="rgba(125,211,252,0.25)"
          strokeWidth="1.2"
          strokeDasharray="3 9"
          strokeLinecap="round"
        />
      </svg>
      {bacteria.map((b, i) => (
        <div
          key={i}
          className="bacteria-drift absolute left-0"
          style={{
            top: b.top,
            animationDelay: b.delay,
            animationDuration: b.duration,
            transform: `scale(${b.scale})`,
          }}
        >
          <div className="bacteria-wiggle drop-shadow-[0_0_6px_rgba(125,211,252,0.5)]">
            <BacteriumShape kind={b.kind} color={b.color} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function AuthStoryPanel() {
  return (
    <aside className="relative overflow-hidden border-b border-white/10 bg-[#04101f] text-white lg:border-b-0 lg:border-r lg:border-r-white/10">
      {/* Bold ambient glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_8%_15%,rgba(34,211,238,0.22),transparent_45%),radial-gradient(circle_at_92%_82%,rgba(16,185,129,0.2),transparent_48%),radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.08),transparent_60%)]" />
      <div className="absolute inset-0 organism-grid opacity-[0.05]" />
      {/* Diagonal accent beam */}
      <div className="absolute -top-20 -right-20 h-72 w-72 rotate-12 rounded-full bg-gradient-to-br from-cyan-400/20 to-emerald-400/10 blur-3xl" />

      <div className="relative z-10 flex h-full flex-col p-6 sm:p-8 lg:p-10 xl:p-12">
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-400/10 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-100">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-300" />
          </span>
          By microbiologists · for microbiologists
        </div>

        <h1 className="mt-5 max-w-xl font-serif text-4xl font-bold leading-[1.05] tracking-tight text-slate-50 sm:text-5xl xl:text-[3.4rem]">
          From the swab
          <br />
          in your hand —
          <br />
          <span className="bg-gradient-to-r from-cyan-300 via-teal-200 to-emerald-300 bg-clip-text text-transparent">
            to the antibiotic
          </span>
          <br />
          <span className="bg-gradient-to-r from-emerald-300 to-cyan-200 bg-clip-text text-transparent">
            that saves a life.
          </span>
        </h1>
        <p className="mt-4 max-w-lg text-[13px] leading-relaxed text-slate-300/95 sm:text-sm">
          One governed, audit-traceable workflow for every isolate —
          built around how real microbiology labs actually work.
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          {chips.map((chip) => (
            <span
              key={chip}
              className="rounded-full border border-cyan-200/20 bg-white/[0.04] px-3 py-1 text-[11px] font-medium text-slate-200/90"
            >
              {chip}
            </span>
          ))}
        </div>

        <section className="relative mt-7 flex-1 rounded-3xl border border-white/15 bg-gradient-to-br from-slate-950/70 to-slate-950/40 p-5 shadow-[0_0_40px_-12px_rgba(34,211,238,0.25)] sm:p-6">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-cyan-200">
              The Medugu pathway
            </p>
            <p className="text-[11px] font-medium text-slate-400">5 stages · 1 source of truth</p>
          </div>

          <div className="relative mt-6">
            <BacteriaFlow />
            <ol className="grid grid-cols-2 gap-3 md:grid-cols-5">
              {stages.map((s, i) => (
                <li key={s.title} className="relative">
                  <div className="absolute -top-2.5 left-3 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-cyan-300/40 bg-slate-950 text-[11px] font-bold text-cyan-200 shadow-[0_0_12px_rgba(34,211,238,0.4)]">
                    {i + 1}
                  </div>
                  <StoryStage
                    title={s.title}
                    caption={s.caption}
                    tone={s.tone}
                    delay={i * 2.4}
                    icon={s.icon}
                  />
                </li>
              ))}
            </ol>
          </div>

          <div className="mt-6 flex items-center justify-between rounded-2xl border border-emerald-300/20 bg-gradient-to-r from-emerald-500/10 to-cyan-500/5 px-4 py-3.5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full border border-emerald-300/50 bg-emerald-400/15 shadow-[0_0_16px_rgba(52,211,153,0.4)]">
                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden>
                  <path className="report-tick" d="M5 10.5l3 3 7-7.5" stroke="rgb(110,231,183)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <p className="text-[13px] font-bold text-slate-50">Audit-ready release</p>
                <p className="text-[11px] text-slate-400">Every change signed, versioned, traceable.</p>
              </div>
            </div>
            <span className="hidden rounded-full border border-cyan-300/40 bg-cyan-400/15 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-cyan-100 sm:inline">
              EUCAST 2026
            </span>
          </div>
        </section>
      </div>
    </aside>
  );
}
