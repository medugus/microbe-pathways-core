import { StoryPathway } from "@/auth/StoryPathway";
import { StoryStage } from "@/auth/StoryStage";

const chips = [
  "Blood culture",
  "AST / EUCAST",
  "IPC surveillance",
  "AMS stewardship",
  "Audit-ready release",
] as const;

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
      <path d="M16 18H32" stroke="rgba(186,230,253,0.9)" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M16 24H32" stroke="rgba(186,230,253,0.9)" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M16 30H32" stroke="rgba(186,230,253,0.9)" strokeWidth="1.4" strokeLinecap="round" />
      <circle className="ast-cell" cx="14" cy="18" r="1.9" fill="rgba(52,211,153,0.9)" />
      <circle className="ast-cell" cx="14" cy="24" r="1.9" fill="rgba(251,191,36,0.9)" style={{ animationDelay: "1s" }} />
      <circle className="ast-cell" cx="14" cy="30" r="1.9" fill="rgba(248,113,113,0.9)" style={{ animationDelay: "2s" }} />
    </svg>
  );
}

function ReportIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-7 w-7" fill="none" aria-hidden>
      <rect x="12" y="8" width="24" height="32" rx="4" stroke="rgba(191,219,254,0.95)" strokeWidth="1.6" />
      <path d="M18 18H30M18 24H30M18 30H26" stroke="rgba(147,197,253,0.95)" strokeWidth="1.6" strokeLinecap="round" />
      <path className="report-tick" d="M28 31L30.5 33.5L35 29" stroke="rgba(52,211,153,0.95)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ActionIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-7 w-7" fill="none" aria-hidden>
      <circle cx="14" cy="20" r="5" stroke="rgba(186,230,253,0.95)" strokeWidth="1.5" />
      <path d="M8 32C8 28.5 10.7 26 14 26C17.3 26 20 28.5 20 32" stroke="rgba(186,230,253,0.95)" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="24" y="10" width="14" height="9" rx="2" stroke="rgba(167,243,208,0.95)" strokeWidth="1.5" />
      <rect x="24" y="22" width="14" height="9" rx="2" stroke="rgba(251,191,36,0.95)" strokeWidth="1.5" />
      <path d="M24 36H38" stroke="rgba(147,197,253,0.95)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function AuthStoryPanel() {
  return (
    <aside className="relative overflow-hidden border-b border-white/10 bg-[#061227] text-white lg:border-b-0 lg:border-r lg:border-r-white/10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_20%,rgba(34,211,238,0.12),transparent_42%),radial-gradient(circle_at_85%_78%,rgba(16,185,129,0.11),transparent_45%)]" />
      <div className="relative z-10 flex h-full flex-col p-6 sm:p-8 lg:p-10 xl:p-11">
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-cyan-100/20 bg-cyan-100/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-100/90">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
          Medugu Microbiology Suite
        </div>

        <h1 className="mt-4 max-w-lg text-2xl font-semibold tracking-tight text-slate-100 sm:text-3xl">
          From culture to clinical action.
        </h1>
        <p className="mt-2 max-w-xl text-sm text-slate-300/90">
          Medugu connects culture, AST, IPC and stewardship in one microbiology-native workflow.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {chips.map((chip) => (
            <span key={chip} className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] text-slate-200/90">
              {chip}
            </span>
          ))}
        </div>

        <section className="relative mt-5 flex-1 rounded-3xl border border-white/15 bg-slate-950/45 p-3 sm:p-4">
          <StoryPathway />
          <div className="grid h-full grid-cols-1 gap-3 md:grid-cols-2 md:grid-rows-2">
            <StoryStage
              title="Culture"
              caption="Specimen and petri culture enter the governed workflow."
              tone="culture"
              delay={0}
              icon={<PetriDishIcon />}
            />
            <StoryStage
              title="Interpret"
              caption="AST panel resolves isolate signal with S/I/R cues."
              tone="interpret"
              delay={3}
              icon={<AstPanelIcon />}
              className="md:mt-10"
            />
            <StoryStage
              title="Report"
              caption="Traceable microbiology report assembles for release."
              tone="report"
              delay={6}
              icon={<ReportIcon />}
            />
            <StoryStage
              title="Act"
              caption="Clinician, IPC, and AMS actions activate in sequence."
              tone="action"
              delay={9}
              icon={<ActionIcon />}
              className="md:mt-10"
            />
          </div>
        </section>
      </div>
    </aside>
  );
}
