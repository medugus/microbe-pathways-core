// Editorial split-screen marketing panel shared across login / signup /
// forgot-password. Dark navy field, serif display headline, animated
// "organism grid" background to evoke colonies on a plate.

export function AuthHero() {
  return (
    <aside className="relative hidden overflow-hidden bg-[#04101f] text-white lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
      {/* Animated organism grid */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.55]">
        <div className="organism-grid absolute inset-0" />
        <div className="absolute inset-0 bg-gradient-to-br from-[#04101f] via-transparent to-[#04101f]" />
        <div className="absolute -left-20 top-1/4 h-72 w-72 rounded-full bg-[#1e6fb8]/30 blur-3xl" />
        <div className="absolute -right-16 bottom-1/4 h-80 w-80 rounded-full bg-[#0b3a66]/40 blur-3xl" />
      </div>

      <div className="relative z-10 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-white/70">
        <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_2px_rgba(52,211,153,0.7)]" />
        Medugu · Microbiology Suite
      </div>

      <div className="relative z-10 max-w-xl">
        <h1 className="font-serif text-5xl leading-[1.05] tracking-tight text-white xl:text-6xl">
          Culture. IPC. AMS.
          <br />
          <span className="italic text-white/90">One workflow.</span>{" "}
          <span className="font-bold">Zero compromise.</span>
        </h1>
        <p className="mt-6 max-w-md text-lg leading-relaxed text-white/75">
          Designed by microbiologists, for microbiologists — Medugu integrates
          blood culture, infection prevention, and antimicrobial stewardship
          better than any platform on the market.
        </p>

        <div className="mt-8 flex flex-wrap gap-2">
          <Chip label="Blood Culture" dot="#34d399" />
          <Chip label="IPC Surveillance" dot="#f59e0b" />
          <Chip label="AMS Stewardship" dot="#60a5fa" />
        </div>
      </div>

      <div className="relative z-10 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] uppercase tracking-wider text-white/55">
        <span>EUCAST 2026 breakpoints</span>
        <span aria-hidden>·</span>
        <span>FHIR R4</span>
        <span aria-hidden>·</span>
        <span>HL7 v2.5 native</span>
        <span aria-hidden>·</span>
        <span>Audit-ready release seal</span>
      </div>
    </aside>
  );
}

function Chip({ label, dot }: { label: string; dot: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-white/90 backdrop-blur-sm">
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: dot, boxShadow: `0 0 8px ${dot}` }}
      />
      {label}
    </span>
  );
}

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr] xl:grid-cols-[1.25fr_1fr]">
      <AuthHero />
      <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
