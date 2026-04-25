export { PatientSection } from "./PatientSection";
export { SpecimenSection } from "./SpecimenSection";
export { MicroscopySection } from "./MicroscopySection";
export { IsolateSection } from "./IsolateSection";
export { ASTSection } from "./ASTSection";
export { StewardshipSection } from "./StewardshipSection";
export { AMSSection } from "./AMSSection";
export { IPCSection } from "./IPCSection";
export { ValidationSection } from "./ValidationSection";
export { ReleaseSection } from "./ReleaseSection";
export { ReportSection } from "./ReportSection";
export { ExportSection } from "./ExportSection";
export { BenchmarkSection } from "./BenchmarkSection";

export const SECTION_ORDER = [
  { key: "patient", label: "Patient" },
  { key: "specimen", label: "Specimen" },
  { key: "microscopy", label: "Microscopy" },
  { key: "isolate", label: "Isolate" },
  { key: "ast", label: "AST" },
  { key: "stewardship", label: "Stewardship" },
  { key: "ams", label: "AMS approvals" },
  { key: "ipc", label: "IPC" },
  { key: "validation", label: "Validation" },
  { key: "release", label: "Release" },
  { key: "report", label: "Report" },
  { key: "export", label: "Export" },
  { key: "benchmark", label: "Command Centre" },
] as const;

export type SectionKey = (typeof SECTION_ORDER)[number]["key"];
