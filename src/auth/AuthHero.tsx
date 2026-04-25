import { Link } from "@tanstack/react-router";

type AuthRoute = "login" | "signup" | "forgot" | "reset";

const pathwaySteps = [
  { window: "0–15 sec", label: "Specimen / Culture", detail: "Bottle loaded · incubation starts" },
  {
    window: "15–30 sec",
    label: "Growth & Identification",
    detail: "Early growth signal · organism clues",
  },
  {
    window: "30–45 sec",
    label: "AST / Breakpoints",
    detail: "EUCAST 2026 S / I / R interpretation",
  },
  { window: "45–60 sec", label: "AMS Review", detail: "De-escalation + AWaRe recommendation" },
  { window: "60 sec", label: "IPC Action", detail: "MDRO alert · contact precautions triggered" },
] as const;

const trustChips = [
  "Blood Culture",
  "Culture & AST",
  "AMS Stewardship",
  "IPC Signals",
  "EUCAST 2026",
  "Audit-ready",
] as const;

const storyCards = [
  {
    title: "Blood culture",
    metric: "TTP 11h 42m",
    details: "Bottle B2 flagged positive",
    glow: "from-cyan-300/30 via-sky-400/10 to-transparent",
  },
  {
    title: "Culture plate",
    metric: "Heavy growth",
    details: "MacConkey · lactose fermenter",
    glow: "from-teal-300/20 via-cyan-300/10 to-transparent",
  },
  {
    title: "AST / EUCAST 2026",
    metric: "S: MEM · I: TZP · R: CIP",
    details: "Breakpoint interpretation complete",
    glow: "from-blue-300/25 via-indigo-300/10 to-transparent",
  },
  {
    title: "AMS review",
    metric: "Recommend de-escalation",
    details: "AWaRe Watch → Access",
    glow: "from-emerald-300/25 via-teal-300/10 to-transparent",
  },
  {
    title: "IPC signal",
    metric: "MDRO alert raised",
    details: "Contact precautions advised",
    glow: "from-orange-300/20 via-amber-300/10 to-transparent",
  },
] as const;

export function AuthHero() {
  return (
    <aside className="relative overflow-hidden border-b border-white/10 bg-[#031226] text-white lg:border-b-0 lg:border-r lg:border-r-white/10">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-28 top-6 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl motion-safe:animate-auth-float" />
        <div className="absolute right-0 top-1/3 h-80 w-80 rounded-full bg-blue-500/20 blur-3xl motion-safe:animate-auth-float-delayed" />
        <div className="absolute bottom-6 left-1/3 h-60 w-60 rounded-full bg-teal-300/20 blur-3xl motion-safe:animate-auth-float-slow" />
      </div>

      <div className="relative z-10 p-6 sm:p-8 lg:p-10 xl:p-12">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-100/90 backdrop-blur-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_10px_rgba(110,231,183,.9)]" />
          Medugu microbiology workflow
        </div>

        <h1 className="mt-5 text-balance font-serif text-4xl leading-[1.02] tracking-tight sm:text-5xl xl:text-6xl">
          Culture. Results. AMS. IPC.
          <span className="mt-2 block text-white/85">One workflow. Zero delay.</span>
        </h1>

        <p className="mt-5 max-w-2xl text-sm leading-relaxed text-slate-200/85 sm:text-base">
          Built by microbiologists, for microbiologists. Medugu unifies culture, identification,
          AST, stewardship, and infection prevention into one intelligent workflow so your team acts
          faster with confidence.
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          {trustChips.map((chip, idx) => (
            <span
              key={chip}
              className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs text-cyan-50/95 transition-transform duration-300 hover:-translate-y-0.5"
              style={{ animationDelay: `${idx * 0.5}s` }}
            >
              {chip}
            </span>
          ))}
        </div>

        <section className="mt-6 rounded-2xl border border-white/15 bg-slate-950/35 p-4 backdrop-blur-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100/80">
            Your 1-minute pathway
          </p>
          <div className="mt-3 space-y-2">
            {pathwaySteps.map((step, idx) => (
              <div
                key={step.label}
                className="relative rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2"
              >
                <div
                  className="auth-pathway-pulse pointer-events-none absolute inset-y-1 left-0 w-1 rounded-full bg-cyan-300/70 motion-reduce:hidden"
                  style={{ animationDelay: `${idx * 1.4}s` }}
                />
                <div className="flex items-start justify-between gap-2 pl-3">
                  <div>
                    <p className="text-sm font-medium text-white">{step.label}</p>
                    <p className="text-xs text-slate-300/80">{step.detail}</p>
                  </div>
                  <p className="text-[11px] font-medium text-cyan-100/90">{step.window}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {storyCards.map((card, idx) => (
            <article
              key={card.title}
              className="auth-story-card group relative overflow-hidden rounded-xl border border-white/15 bg-white/[0.04] p-3 backdrop-blur-sm"
              style={{ animationDelay: `${idx * 1.6}s` }}
            >
              <div
                className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${card.glow} opacity-70`}
              />
              <div className="relative">
                <p className="text-xs uppercase tracking-wide text-cyan-100/85">{card.title}</p>
                <p className="mt-1 text-sm font-semibold text-white">{card.metric}</p>
                <p className="mt-1 text-xs text-slate-300/85">{card.details}</p>
              </div>
            </article>
          ))}
        </section>

        <div className="mt-6 hidden flex-wrap items-center gap-x-3 gap-y-1 text-[11px] uppercase tracking-[0.14em] text-slate-300/75 sm:flex">
          <span>EUCAST 2026 breakpoints</span>
          <span aria-hidden>•</span>
          <span>FHIR R4</span>
          <span aria-hidden>•</span>
          <span>HL7 v2.5 native</span>
          <span aria-hidden>•</span>
          <span>Audit-ready</span>
          <span aria-hidden>•</span>
          <span>ISO 15189 aligned</span>
        </div>
      </div>
    </aside>
  );
}

function AuthNavTabs({ currentPage }: { currentPage?: AuthRoute }) {
  const tabs: Array<{ key: AuthRoute; label: string; to: string }> = [
    { key: "login", label: "Sign in", to: "/login" },
    { key: "signup", label: "Create account", to: "/signup" },
    { key: "forgot", label: "Reset password", to: "/forgot-password" },
  ];

  return (
    <div className="mb-5 grid grid-cols-3 gap-2 rounded-lg border border-border bg-muted/40 p-1 text-xs sm:text-sm">
      {tabs.map((tab) => {
        const active = currentPage === tab.key;
        return (
          <Link
            key={tab.key}
            to={tab.to}
            className={`rounded-md px-2 py-1.5 text-center font-medium transition-colors ${
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}

export function AuthShell({
  children,
  currentPage,
}: {
  children: React.ReactNode;
  currentPage?: AuthRoute;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.15fr_1fr] xl:grid-cols-[1.2fr_1fr]">
      <AuthHero />
      <main className="flex min-h-screen items-center justify-center bg-background px-4 py-8 sm:px-6">
        <div className="w-full max-w-md">
          <AuthNavTabs currentPage={currentPage} />
          {children}
        </div>
      </main>
    </div>
  );
}
