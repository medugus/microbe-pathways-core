import { StoryStage } from "@/auth/StoryStage";

const chips = [
  "Specimen integrity",
  "Culture & ID",
  "AST / EUCAST",
  "IPC surveillance",
  "AMS stewardship",
] as const;

function SpecimenIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-7 w-7" fill="none" aria-hidden>
      <path d="M18 6h12v6l-4 6v16a4 4 0 0 1-8 0V18l-4-6V6z" stroke="rgba(186,230,253,0.95)" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M16 24h16" stroke="rgba(125,211,252,0.85)" strokeWidth="1.4" strokeLinecap="round" />
      <circle className="petri-colony" cx="22" cy="30" r="1.6" fill="rgba(248,113,113,0.85)" />
      <circle className="petri-colony" cx="27" cy="34" r="1.4" fill="rgba(251,191,36,0.85)" style={{ animationDelay: "0.7s" }} />
      <path d="M20 10h8" stroke="rgba(167,243,208,0.9)" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function PetriDishIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-7 w-7" fill="none" aria-hidden>
      <circle cx="24" cy="24" r="16" stroke="rgba(186,230,253,0.95)" strokeWidth="1.8" />
      <circle cx="24" cy="24" r="11" stroke="rgba(45,212,191,0.8)" strokeWidth="1.4" />
      <circle className="petri-colony" cx="20" cy="20" r="2.1" fill="rgba(125,211,252,0.9)" />
      <circle className="petri-colony" cx="28" cy="25" r="1.8" fill="rgba(52,211,153,0.9)" style={{ animationDelay: "0.8s" }} />
      <circle className="petri-colony" cx="23" cy="30" r="1.6" fill="rgba(103,232,249,0.85)" style={{ animationDelay: "1.6s" }} />
    </svg>
  );
}

function AstPanelIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-7 w-7" fill="none" aria-hidden>
      <rect x="8" y="10" width="32" height="28" rx="5" stroke="rgba(153,246,228,0.9)" strokeWidth="1.5" />
      <path d="M16 18H32M16 24H32M16 30H32" stroke="rgba(186,230,253,0.9)" strokeWidth="1.4" strokeLinecap="round" />
      <circle className="ast-cell" cx="14" cy="18" r="1.9" fill="rgba(52,211,153,0.95)" />
      <circle className="ast-cell" cx="14" cy="24" r="1.9" fill="rgba(251,191,36,0.95)" style={{ animationDelay: "1s" }} />
      <circle className="ast-cell" cx="14" cy="30" r="1.9" fill="rgba(248,113,113,0.95)" style={{ animationDelay: "2s" }} />
    </svg>
  );
}

function IpcShieldIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-7 w-7" fill="none" aria-hidden>
      <path d="M24 6l14 5v11c0 9-6 15-14 18-8-3-14-9-14-18V11l14-5z" stroke="rgba(191,219,254,0.95)" strokeWidth="1.6" strokeLinejoin="round" />
      <path className="report-tick" d="M18 24l4 4 8-9" stroke="rgba(52,211,153,0.95)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle className="petri-colony" cx="14" cy="16" r="1.2" fill="rgba(248,113,113,0.85)" style={{ animationDelay: "1.2s" }} />
    </svg>
  );
}

function AmsIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-7 w-7" fill="none" aria-hidden>
      <rect x="8" y="14" width="22" height="10" rx="3" stroke="rgba(167,243,208,0.95)" strokeWidth="1.5" />
      <rect x="14" y="26" width="22" height="10" rx="3" stroke="rgba(186,230,253,0.95)" strokeWidth="1.5" />
      <path d="M30 19h6M36 19l-2-2M36 19l-2 2" stroke="rgba(251,191,36,0.95)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path className="report-tick" d="M18 31l3 3 6-6" stroke="rgba(52,211,153,0.95)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const stages = [
  { title: "Specimen", caption: "Right sample, right tube, right time — documented at collection.", tone: "specimen" as const, icon: <SpecimenIcon /> },
  { title: "Culture & ID", caption: "Growth, morphology and organism identification — captured cleanly.", tone: "culture" as const, icon: <PetriDishIcon /> },
  { title: "AST", caption: "EUCAST-aligned interpretation with S / I / R signals you can trust.", tone: "interpret" as const, icon: <AstPanelIcon /> },
  { title: "IPC", caption: "Outbreak signals and isolation actions surface in real time.", tone: "report" as const, icon: <IpcShieldIcon /> },
  { title: "AMS", caption: "Stewardship-ready report drives the right antibiotic, sooner.", tone: "action" as const, icon: <AmsIcon /> },
];

function StoryFlowPath() {
  return (
    <div className="pointer-events-none absolute inset-x-4 top-[68px] hidden md:block" aria-hidden>
      <svg className="h-3 w-full" viewBox="0 0 1000 12" preserveAspectRatio="none" fill="none">
        <defs>
          <linearGradient id="flowBase" x1="0" y1="6" x2="1000" y2="6" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="rgba(34,211,238,0.35)" />
            <stop offset="0.5" stopColor="rgba(96,165,250,0.45)" />
            <stop offset="1" stopColor="rgba(16,185,129,0.4)" />
          </linearGradient>
          <linearGradient id="flowPulse" x1="0" y1="6" x2="1000" y2="6" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="rgba(125,211,252,0)" />
            <stop offset="0.5" stopColor="rgba(125,211,252,1)" />
            <stop offset="1" stopColor="rgba(52,211,153,0)" />
          </linearGradient>
        </defs>
        <line x1="0" y1="6" x2="1000" y2="6" stroke="url(#flowBase)" strokeWidth="2" strokeLinecap="round" />
        <line
          className="story-path-pulse"
          x1="0"
          y1="6"
          x2="1000"
          y2="6"
          stroke="url(#flowPulse)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray="60 940"
        />
      </svg>
    </div>
  );
}

export function AuthStoryPanel() {
  return (
    <aside className="relative overflow-hidden border-b border-white/10 bg-[#061227] text-white lg:border-b-0 lg:border-r lg:border-r-white/10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_20%,rgba(34,211,238,0.14),transparent_42%),radial-gradient(circle_at_85%_78%,rgba(16,185,129,0.12),transparent_45%)]" />
      <div className="absolute inset-0 organism-grid opacity-[0.06]" />

      <div className="relative z-10 flex h-full flex-col p-6 sm:p-8 lg:p-10 xl:p-11">
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-cyan-100/20 bg-cyan-100/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-100/90">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 animate-pulse" />
          By microbiologists, for microbiologists
        </div>

        <h1 className="mt-4 max-w-xl font-serif text-3xl leading-tight tracking-tight text-slate-50 sm:text-4xl">
          From the swab in your hand
          <br />
          <span className="bg-gradient-to-r from-cyan-200 via-teal-200 to-emerald-200 bg-clip-text text-transparent">
            to the antibiotic that saves a life.
          </span>
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-300/90">
          Medugu walks every isolate through the path real microbiology labs follow —
          accurate specimen capture, culture, AST, IPC surveillance and AMS-ready reporting —
          one governed, audit-traceable workflow.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {chips.map((chip) => (
            <span
              key={chip}
              className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] text-slate-200/90"
            >
              {chip}
            </span>
          ))}
        </div>

        <section className="relative mt-6 flex-1 rounded-3xl border border-white/15 bg-slate-950/55 p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-100/80">
              The Medugu pathway
            </p>
            <p className="text-[11px] text-slate-400/80">5 stages · 1 source of truth</p>
          </div>

          <div className="relative mt-5">
            <StoryFlowPath />
            <ol className="grid grid-cols-2 gap-3 md:grid-cols-5">
              {stages.map((s, i) => (
                <li key={s.title} className="relative">
                  <div className="absolute -top-2 left-3 z-10 flex h-5 w-5 items-center justify-center rounded-full border border-white/20 bg-slate-950 text-[10px] font-semibold text-cyan-100/90">
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

          <div className="mt-5 flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full border border-emerald-300/40 bg-emerald-400/10">
                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden>
                  <path className="report-tick" d="M5 10.5l3 3 7-7.5" stroke="rgb(110,231,183)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-100">Audit-ready release</p>
                <p className="text-[11px] text-slate-400">Every change signed, versioned, traceable.</p>
              </div>
            </div>
            <span className="hidden rounded-full border border-cyan-200/30 bg-cyan-400/10 px-2.5 py-1 text-[10px] font-medium text-cyan-100/90 sm:inline">
              EUCAST 2026
            </span>
          </div>
        </section>
      </div>
    </aside>
  );
}
