# Medugu Platform v3 — Architecture

Clinical microbiology workflow platform (accession → release). Local-first,
single-user, browser-persisted. All core logic is framework-agnostic and
portable to a plain Vite React project.

## Folder structure

```
src/medugu/
├── README.md
│
├── domain/                      # Framework-agnostic domain model
│   ├── types.ts                 # All TypeScript types/interfaces
│   ├── ids.ts                   # ID generation
│   └── enums.ts                 # Status enums, workflow stages
│
├── store/                       # Central accession state (single source of truth)
│   ├── accessionStore.ts        # Zustand-style store, framework-agnostic core
│   ├── persistence.ts           # localStorage adapter (swappable)
│   ├── useAccessionStore.ts     # React binding
│   └── selectors.ts             # Memoizable selectors
│
├── config/                      # Coded dictionaries (NOT free text)
│   ├── specimenFamilies.ts      # Specimen families + subtypes
│   ├── organisms.ts             # Organism catalog (genus/species/gram/etc)
│   ├── antibiotics.ts           # Antimicrobial catalog (class/route/code)
│   ├── breakpoints.ts           # CLSI/EUCAST breakpoint table stubs
│   ├── syndromes.ts             # Clinical syndromes
│   ├── ipcRules.ts              # IPC alert organism/resistance triggers
│   └── index.ts
│
├── logic/                       # Pure rule engines (no React)
│   ├── specimenResolver.ts      # coded specimen → workflow profile
│   ├── astEngine.ts             # MIC/disk → S/I/R interpretation
│   ├── stewardshipEngine.ts     # AMS flags / formulary review
│   ├── ipcEngine.ts             # Alert organism + transmission flags
│   ├── workflowEngine.ts        # Stage gating + required fields
│   ├── validationEngine.ts      # Pre-release validation rules
│   ├── reportBuilder.ts         # Structured report assembly
│   └── exporter.ts              # JSON / HL7-ish / CSV export shapes
│
├── utils/
│   ├── format.ts                # Date/ID/label formatting
│   ├── audit.ts                 # Audit event helpers
│   └── exportHelpers.ts         # Download/blob helpers
│
├── seed/
│   └── demoAccessions.ts        # Seeded demo case list
│
└── ui/                          # React layer
    ├── AppShell.tsx             # Layout: case manager + section tabs
    ├── CaseManager.tsx          # Accession list / new case
    ├── SectionTabs.tsx          # Tab nav across the 11 sections
    └── sections/
        ├── PatientSection.tsx
        ├── SpecimenSection.tsx
        ├── MicroscopySection.tsx
        ├── IsolateSection.tsx
        ├── ASTSection.tsx
        ├── StewardshipSection.tsx
        ├── IPCSection.tsx
        ├── ValidationSection.tsx
        ├── ReleaseSection.tsx
        ├── ReportSection.tsx
        └── ExportSection.tsx
```

## Layering rules

- `domain/`, `config/`, `logic/`, `utils/`, `store/` core — **zero React imports**.
- `store/useAccessionStore.ts` is the only React binding for the store.
- `ui/` consumes store + logic only; never inlines business rules.
- Free-text specimen labels are display-only. Logic keys off `specimenFamily`,
  `specimenSubtype`, `organismCode`, `antibioticCode`, `ruleCode`.

## Persistence

`localStorage` key: `medugu.v3.state`. Adapter in `store/persistence.ts` is
swappable (IndexedDB/remote later). State is JSON-serializable.

## Phase scope

This commit delivers: structure, types, app shell, persistence, demo seed.
Detailed rule implementations land in subsequent phases.
