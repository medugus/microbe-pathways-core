// Marketing landing page for unauthenticated visitors.
// Navy & Blue aesthetic — deep navy ground, crisp white type, electric blue accents.
// Presentation-only: no store mutations, no engine calls.

import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  ShieldCheck,
  FlaskConical,
  Activity,
  Microscope,
  FileCheck2,
  GitBranch,
  Sparkles,
  CheckCircle2,
} from "lucide-react";

const DEEP_NAVY = "#020617";
const MID_NAVY = "#0B1A33";
const CARD_NAVY = "#0F2440";
const ICE = "#E6EEFB";
const SKY = "#93C5FD";
const BLUE_ACCENT = "#3B82F6";
const ELECTRIC = "#60A5FA";
const DIM = "#6E89B5";

export function MarketingLanding() {
  return (
    <div
      className="relative min-h-screen overflow-hidden"
      style={{ background: DEEP_NAVY, color: ICE }}
    >
      <AmbientBackdrop />
      <div className="relative z-10">
        <Nav />
        <Hero />
        <TrustStrip />
        <Pillars />
        <Features />
        <Stats />
        <Quote />
        <Pricing />
        <CtaBand />
        <Footer />
      </div>
    </div>
  );
}

/* ---------- Backdrop ---------- */

function AmbientBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 50% at 12% 10%, rgba(59,130,246,0.22), transparent 60%), radial-gradient(45% 45% at 88% 22%, rgba(30,58,138,0.35), transparent 65%), radial-gradient(80% 60% at 50% 110%, rgba(59,130,246,0.12), transparent 70%)",
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(230,238,251,0.5) 0 1px, transparent 1px 80px), repeating-linear-gradient(90deg, rgba(230,238,251,0.5) 0 1px, transparent 1px 80px)",
        }}
      />
    </div>
  );
}

/* ---------- Nav ---------- */

function Nav() {
  return (
    <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
      <Link to="/" className="flex items-center gap-2.5">
        <Logo />
        <span className="font-serif text-xl tracking-tight" style={{ color: ICE }}>
          Medugu
        </span>
      </Link>
      <nav className="hidden items-center gap-8 text-sm md:flex" style={{ color: DIM }}>
        <a href="#pillars" className="hover:text-white transition-colors">Workflow</a>
        <a href="#features" className="hover:text-white transition-colors">Platform</a>
        <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
      </nav>
      <div className="flex items-center gap-2">
        <Link
          to="/login"
          className="hidden rounded-md px-3 py-2 text-sm font-medium hover:text-white sm:inline-flex transition-colors"
          style={{ color: DIM }}
        >
          Sign in
        </Link>
        <Button
          asChild
          className="rounded-full px-5 shadow-lg border-0"
          style={{ background: BLUE_ACCENT, color: "#FFFFFF" }}
        >
          <Link to="/signup">
            Get started <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </header>
  );
}

function Logo() {
  return (
    <span
      className="grid h-9 w-9 place-items-center rounded-lg"
      style={{ background: `linear-gradient(135deg, ${BLUE_ACCENT}, #1E3A8A)` }}
    >
      <FlaskConical className="h-5 w-5" style={{ color: ICE }} />
    </span>
  );
}

/* ---------- Hero ---------- */

function Hero() {
  return (
    <section className="mx-auto grid max-w-7xl gap-12 px-6 pb-20 pt-12 lg:grid-cols-[1.15fr_1fr] lg:pt-20">
      <div className="flex flex-col justify-center">
        <span
          className="inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-xs uppercase tracking-[0.18em]"
          style={{ borderColor: "rgba(147,197,253,0.25)", color: SKY }}
        >
          <Sparkles className="h-3.5 w-3.5" style={{ color: ELECTRIC }} />
          EUCAST 2026 · Audit-grade microbiology
        </span>
        <h1
          className="mt-6 font-serif text-[clamp(2.6rem,6vw,4.8rem)] font-normal leading-[1.02] tracking-tight"
          style={{ color: ICE }}
        >
          From culture plate
          <br />
          to clinical action,
          <br />
          <em className="italic" style={{ color: ELECTRIC }}>without the chaos.</em>
        </h1>
        <p className="mt-6 max-w-xl text-base leading-relaxed sm:text-lg" style={{ color: DIM }}>
          Medugu is the microbiology-native workflow trusted to move specimens
          from accession through AST interpretation, stewardship review and
          sealed release — with every step governed, traceable and EUCAST-true.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Button
            asChild
            size="lg"
            className="rounded-full px-6 text-base shadow-xl border-0"
            style={{ background: BLUE_ACCENT, color: "#FFFFFF" }}
          >
            <Link to="/signup">
              Start free trial <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="rounded-full border-sky-400/30 bg-sky-400/5 px-6 text-base text-sky-100 hover:bg-sky-400/10 hover:text-white"
          >
            <Link to="/login">See it in action</Link>
          </Button>
        </div>
        <dl className="mt-10 grid max-w-lg grid-cols-3 gap-6 text-sm" style={{ color: DIM }}>
          {[
            ["2026", "EUCAST registry"],
            ["100%", "Hash-bound release"],
            ["24/7", "IPC surveillance"],
          ].map(([k, v]) => (
            <div key={v as string}>
              <dt className="font-serif text-2xl" style={{ color: ICE }}>{k}</dt>
              <dd className="mt-1 text-xs uppercase tracking-wider">{v}</dd>
            </div>
          ))}
        </dl>
      </div>

      <HeroVisual />
    </section>
  );
}

function HeroVisual() {
  return (
    <div className="relative">
      <div
        className="absolute -inset-6 rounded-[2rem] blur-3xl"
        style={{ background: `radial-gradient(circle, ${BLUE_ACCENT}30, transparent 70%)` }}
      />
      <div
        className="relative overflow-hidden rounded-3xl border p-1"
        style={{
          borderColor: "rgba(147,197,253,0.15)",
          background:
            "linear-gradient(160deg, rgba(147,197,253,0.06), rgba(30,58,138,0.25))",
        }}
      >
        <div
          className="rounded-[1.4rem] p-6"
          style={{ background: "rgba(5,11,26,0.88)", backdropFilter: "blur(8px)" }}
        >
          <div className="flex items-center justify-between text-[11px] uppercase tracking-widest" style={{ color: DIM }}>
            <span>Case · AMC-1142</span>
            <span className="rounded-full px-2 py-0.5" style={{ background: "rgba(30,58,138,0.5)", color: ELECTRIC }}>
              Released
            </span>
          </div>
          <div className="mt-5 font-serif text-2xl" style={{ color: ICE }}>
            Escherichia coli — Blood
          </div>
          <div className="mt-1 text-xs" style={{ color: DIM }}>
            Patient #88421 · IPC flag: BSI cluster watch
          </div>

          <div className="mt-6 grid grid-cols-3 gap-2 text-center text-xs">
            {[
              ["Meropenem", "S", "#1E40AF"],
              ["Cefepime", "I", "#A16207"],
              ["Cipro", "R", "#9A3412"],
              ["Gentamicin", "S", "#1E40AF"],
              ["Piperacillin", "S", "#1E40AF"],
              ["Ceftazidime", "R", "#9A3412"],
            ].map(([drug, v, bg]) => (
              <div
                key={drug}
                className="rounded-lg border p-2"
                style={{
                  borderColor: "rgba(147,197,253,0.10)",
                  background: "rgba(147,197,253,0.04)",
                }}
              >
                <div style={{ color: DIM }}>{drug}</div>
                <div
                  className="mt-1 inline-flex h-6 w-6 items-center justify-center rounded-full font-semibold"
                  style={{ background: bg as string, color: ICE }}
                >
                  {v}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 space-y-2">
            {[
              ["Culture", "Plated · 2 colonies"],
              ["AST · EUCAST 2026", "Expert rules applied"],
              ["Stewardship", "De-escalation suggested"],
              ["Validation", "Consultant sealed"],
            ].map(([k, v], i) => (
              <div
                key={k}
                className="flex items-center justify-between rounded-lg px-3 py-2 text-xs"
                style={{
                  background:
                    i === 3
                      ? "rgba(30,58,138,0.30)"
                      : "rgba(147,197,253,0.05)",
                  border: "1px solid rgba(147,197,253,0.08)",
                }}
              >
                <span className="font-medium" style={{ color: ICE }}>{k}</span>
                <span style={{ color: DIM }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Trust strip ---------- */

function TrustStrip() {
  const items = ["EUCAST 2026", "ISO 15189", "HL7 / FHIR", "WHO GLASS", "AMR Surveillance"];
  return (
    <section
      className="border-y"
      style={{
        borderColor: "rgba(147,197,253,0.10)",
        background: "rgba(147,197,253,0.03)",
      }}
    >
      <div
        className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-12 gap-y-3 px-6 py-6 text-xs uppercase tracking-[0.22em]"
        style={{ color: DIM }}
      >
        <span style={{ color: "rgba(147,197,253,0.45)" }}>Aligned with</span>
        {items.map((i) => (
          <span key={i}>{i}</span>
        ))}
      </div>
    </section>
  );
}

/* ---------- Pillars ---------- */

function Pillars() {
  const pillars = [
    {
      icon: Microscope,
      title: "Culture",
      caption: "Specimen accession, microscopy and plate review in one governed lane.",
    },
    {
      icon: FlaskConical,
      title: "Interpret",
      caption: "AST with EUCAST 2026 breakpoints, expert rules and selective reporting.",
    },
    {
      icon: FileCheck2,
      title: "Report",
      caption: "Traceable, hash-bound reports assemble for consultant release.",
    },
    {
      icon: Activity,
      title: "Act",
      caption: "Stewardship and IPC signals trigger clinical action automatically.",
    },
  ];
  return (
    <section id="pillars" className="mx-auto max-w-7xl px-6 py-24">
      <div className="mx-auto max-w-2xl text-center">
        <span className="text-xs uppercase tracking-[0.22em]" style={{ color: ELECTRIC }}>
          The workflow
        </span>
        <h2 className="mt-3 font-serif text-4xl tracking-tight sm:text-5xl" style={{ color: ICE }}>
          One continuous lane,<br />four disciplined stages.
        </h2>
      </div>
      <div className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {pillars.map((p, i) => (
          <div
            key={p.title}
            className="group relative overflow-hidden rounded-2xl border p-6 transition hover:-translate-y-1"
            style={{
              borderColor: "rgba(147,197,253,0.12)",
              background: "rgba(147,197,253,0.04)",
            }}
          >
            <div
              className="absolute inset-x-0 top-0 h-1"
              style={{
                background: `linear-gradient(90deg, ${BLUE_ACCENT}, ${ELECTRIC})`,
                opacity: 0.85,
              }}
            />
            <span
              className="grid h-11 w-11 place-items-center rounded-xl"
              style={{ background: "rgba(59,130,246,0.18)", color: ELECTRIC }}
            >
              <p.icon className="h-5 w-5" />
            </span>
            <div
              className="mt-5 text-[11px] uppercase tracking-[0.22em]"
              style={{ color: DIM }}
            >
              Stage {String(i + 1).padStart(2, "0")}
            </div>
            <h3 className="mt-1 font-serif text-2xl" style={{ color: ICE }}>
              {p.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed" style={{ color: DIM }}>
              {p.caption}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------- Features ---------- */

function Features() {
  const features = [
    {
      icon: ShieldCheck,
      title: "EUCAST 2026, native",
      body: "Breakpoints, expert rules and intrinsic resistance baked in — not bolted on. Updates governed and versioned.",
    },
    {
      icon: GitBranch,
      title: "Selective reporting cascades",
      body: "Drug panels assemble from organism, specimen and patient context. Restricted antibiotics gated by stewardship.",
    },
    {
      icon: Activity,
      title: "IPC surveillance",
      body: "Real-time signals for BSI clusters, MDR colonisation and local watch lists — alerts wired to the right team.",
    },
    {
      icon: FileCheck2,
      title: "Sealed release",
      body: "Reports are hash-bound and cryptographically sealed at consultant validation. Every amendment is traceable.",
    },
    {
      icon: FlaskConical,
      title: "Zone Reader integration",
      body: "Disk-diffusion measurement app round-trips worklists and ZoneResults with the LIMS — no manual transcription.",
    },
    {
      icon: Sparkles,
      title: "AI-assisted triage",
      body: "Worklist triage suggests prioritisation and surfaces anomalies — the microbiologist stays in command.",
    },
  ];
  return (
    <section
      id="features"
      className="border-y px-6 py-24"
      style={{
        borderColor: "rgba(147,197,253,0.10)",
        background:
          "linear-gradient(180deg, rgba(147,197,253,0.02), rgba(30,58,138,0.08))",
      }}
    >
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col items-end justify-between gap-6 md:flex-row">
          <div className="max-w-xl">
            <span className="text-xs uppercase tracking-[0.22em]" style={{ color: ELECTRIC }}>
              Platform
            </span>
            <h2 className="mt-3 font-serif text-4xl tracking-tight sm:text-5xl" style={{ color: ICE }}>
              Built for the bench.<br />Trusted in the boardroom.
            </h2>
          </div>
          <p className="max-w-md text-sm leading-relaxed" style={{ color: DIM }}>
            Every feature exists because a microbiologist asked for it — and every
            release is governed so the lab can prove what was reported, when, and why.
          </p>
        </div>

        <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border md:grid-cols-2 lg:grid-cols-3"
             style={{ borderColor: "rgba(147,197,253,0.10)", background: "rgba(147,197,253,0.10)" }}>
          {features.map((f) => (
            <div
              key={f.title}
              className="p-7 transition hover:bg-sky-400/5"
              style={{ background: MID_NAVY }}
            >
              <span
                className="grid h-10 w-10 place-items-center rounded-lg"
                style={{ background: "rgba(59,130,246,0.20)", color: ELECTRIC }}
              >
                <f.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-5 font-serif text-xl" style={{ color: ICE }}>{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: DIM }}>{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- Stats ---------- */

function Stats() {
  const stats = [
    ["38%", "faster time-to-report"],
    ["100%", "EUCAST 2026 coverage"],
    ["0", "untraceable amendments"],
    ["12+", "integrated engines"],
  ];
  return (
    <section className="mx-auto max-w-7xl px-6 py-24">
      <div
        className="rounded-3xl border p-10"
        style={{
          borderColor: "rgba(147,197,253,0.12)",
          background:
            "linear-gradient(135deg, rgba(59,130,246,0.14), rgba(30,58,138,0.22))",
        }}
      >
        <div className="grid gap-8 md:grid-cols-4">
          {stats.map(([k, v]) => (
            <div key={v}>
              <div
                className="font-serif text-5xl tracking-tight sm:text-6xl"
                style={{ color: ICE }}
              >
                {k}
              </div>
              <div className="mt-2 text-xs uppercase tracking-[0.2em]" style={{ color: DIM }}>
                {v}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- Quote ---------- */

function Quote() {
  return (
    <section className="mx-auto max-w-4xl px-6 py-20 text-center">
      <p className="font-serif text-3xl leading-snug tracking-tight sm:text-4xl" style={{ color: ICE }}>
        “Medugu is the first system that thinks like a microbiologist.
        It doesn't fight the workflow — it <em className="italic" style={{ color: ELECTRIC }}>is</em> the workflow.”
      </p>
      <div className="mt-6 text-xs uppercase tracking-[0.22em]" style={{ color: DIM }}>
        Consultant Microbiologist · Reference Laboratory
      </div>
    </section>
  );
}

/* ---------- Pricing ---------- */

function Pricing() {
  const tiers = [
    {
      name: "Bench",
      price: "$0",
      cadence: "for evaluation",
      blurb: "Single-user trial with the full EUCAST 2026 registry and demo cases.",
      features: ["Demo accessions", "AST + expert rules", "Zone Reader sandbox"],
      cta: "Start free",
      feature: false,
    },
    {
      name: "Laboratory",
      price: "Custom",
      cadence: "per site",
      blurb: "Full LIMS workflow with stewardship, IPC, sealed release and audit trails.",
      features: [
        "Unlimited accessions",
        "AMS + IPC engines",
        "Sealed release governance",
        "Zone Reader integration",
        "HL7 / FHIR export",
      ],
      cta: "Talk to us",
      feature: true,
    },
    {
      name: "Network",
      price: "Custom",
      cadence: "multi-site",
      blurb: "Multi-tenant deployment with cross-site analytics and centralised governance.",
      features: ["Everything in Laboratory", "Cross-site analytics", "Dedicated success team"],
      cta: "Contact sales",
      feature: false,
    },
  ];
  return (
    <section id="pricing" className="mx-auto max-w-7xl px-6 py-24">
      <div className="mx-auto max-w-2xl text-center">
        <span className="text-xs uppercase tracking-[0.22em]" style={{ color: ELECTRIC }}>
          Pricing
        </span>
        <h2 className="mt-3 font-serif text-4xl tracking-tight sm:text-5xl" style={{ color: ICE }}>
          Priced for the lab,<br />not the licence vendor.
        </h2>
      </div>
      <div className="mt-14 grid gap-6 lg:grid-cols-3">
        {tiers.map((t) => (
          <div
            key={t.name}
            className="relative flex flex-col rounded-2xl border p-7"
            style={{
              borderColor: t.feature ? BLUE_ACCENT : "rgba(147,197,253,0.12)",
              background: t.feature
                ? "linear-gradient(180deg, rgba(59,130,246,0.14), rgba(5,11,26,0.6))"
                : "rgba(147,197,253,0.04)",
              boxShadow: t.feature ? `0 30px 80px -40px ${BLUE_ACCENT}` : undefined,
            }}
          >
            {t.feature && (
              <span
                className="absolute -top-3 left-7 rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em]"
                style={{ background: BLUE_ACCENT, color: "#FFFFFF" }}
              >
                Most labs
              </span>
            )}
            <div className="font-serif text-2xl" style={{ color: ICE }}>{t.name}</div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="font-serif text-5xl tracking-tight" style={{ color: ICE }}>{t.price}</span>
              <span className="text-xs uppercase tracking-wider" style={{ color: DIM }}>{t.cadence}</span>
            </div>
            <p className="mt-3 text-sm" style={{ color: DIM }}>{t.blurb}</p>
            <ul className="mt-6 flex-1 space-y-2 text-sm" style={{ color: ICE }}>
              {t.features.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" style={{ color: ELECTRIC }} />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <Button
              asChild
              className="mt-7 w-full rounded-full border-0"
              style={
                t.feature
                  ? { background: BLUE_ACCENT, color: "#FFFFFF" }
                  : { background: "rgba(147,197,253,0.10)", color: ICE }
              }
            >
              <Link to={t.feature ? "/signup" : "/login"}>{t.cta}</Link>
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------- CTA band ---------- */

function CtaBand() {
  return (
    <section className="mx-auto max-w-7xl px-6 pb-24">
      <div
        className="relative overflow-hidden rounded-3xl border px-8 py-14 text-center sm:px-16"
        style={{
          borderColor: "rgba(147,197,253,0.15)",
          background:
            `radial-gradient(circle at 30% 20%, rgba(59,130,246,0.30), transparent 60%), radial-gradient(circle at 80% 80%, rgba(30,58,138,0.35), transparent 60%), ${MID_NAVY}`,
        }}
      >
        <h2 className="font-serif text-4xl tracking-tight sm:text-5xl" style={{ color: ICE }}>
          Move your lab into the<br />governed era of microbiology.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-sm" style={{ color: DIM }}>
          Provision a tenant in minutes. Bring your own breakpoints, panels and
          consultant signatures — keep your governance.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button
            asChild
            size="lg"
            className="rounded-full px-7 text-base shadow-xl border-0"
            style={{ background: BLUE_ACCENT, color: "#FFFFFF" }}
          >
            <Link to="/signup">Start free trial <ArrowRight className="ml-1 h-4 w-4" /></Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="rounded-full border-sky-400/30 bg-sky-400/5 px-7 text-base text-sky-100 hover:bg-sky-400/10 hover:text-white"
          >
            <Link to="/login">Sign in</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

/* ---------- Footer ---------- */

function Footer() {
  return (
    <footer
      className="border-t"
      style={{ borderColor: "rgba(147,197,253,0.10)" }}
    >
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 py-8 text-xs sm:flex-row" style={{ color: DIM }}>
        <div className="flex items-center gap-2">
          <Logo />
          <span className="font-serif text-base" style={{ color: ICE }}>Medugu</span>
          <span className="ml-2">© {new Date().getFullYear()}</span>
        </div>
        <div className="flex items-center gap-6">
          <a href="#features" className="hover:text-white transition-colors">Platform</a>
          <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
          <Link to="/login" className="hover:text-white transition-colors">Sign in</Link>
        </div>
      </div>
    </footer>
  );
}
