// Zone Reader integration settings (placeholder).
//
// Skeleton only — these defaults are read by the Zone Reader UI panel. A
// follow-up change can promote them into configStore as an editable section
// and surface them in admin.config.tsx.

export interface ZoneReaderIntegrationSettings {
  /** Master switch. When false the AST panel hides the Zone Reader entry point. */
  enabled: boolean;
  /** Reader vendor identifier expected in import.sourceSystem (informational). */
  expectedReaderSourceSystem?: string;
  /** Reader confidence below this threshold marks rows as "review". */
  lowConfidenceThreshold: number;
  /** Reject any import older than this many minutes. 0 disables the check. */
  maxImportAgeMinutes: number;
  /** Block imports from any reader the lab has not whitelisted. */
  enforceReaderWhitelist: boolean;
  /** Whitelisted reader source systems (only used when enforceReaderWhitelist=true). */
  readerWhitelist: string[];
}

export const DEFAULT_ZONE_READER_SETTINGS: ZoneReaderIntegrationSettings = {
  enabled: true,
  lowConfidenceThreshold: 0.75,
  maxImportAgeMinutes: 0,
  enforceReaderWhitelist: false,
  readerWhitelist: [],
};

export function getZoneReaderSettings(): ZoneReaderIntegrationSettings {
  // Placeholder: when promoted into configStore, read from
  // configStore.getActivePayload().integrations.zoneReader instead.
  return DEFAULT_ZONE_READER_SETTINGS;
}
