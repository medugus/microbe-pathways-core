export type OperatingMode = 'standalone' | 'medugu_lims_connected' | 'third_party_lis_connected'
export type InterpretationAuthority = 'measurement_only' | 'zone_reader_interprets' | 'lis_interprets'
export type AstStandard = 'EUCAST' | 'CLSI' | 'LOCAL'
export type ImageQualityStatus = 'acceptable' | 'needs_review' | 'rejected'

export interface PlateRecord {
  id: string
  accessionNumber: string
  patientIdentifier: string
  specimenType: string
  organismName: string
  organismGroup: string
  plateSizeMm: number
  imageReference: string
  qcStatus: string
  operatingMode: OperatingMode
  interpretationAuthority: InterpretationAuthority
  worklistId: string
  isolateId: string
  externalLisAccessionId: string
  externalLisIsolateId: string
  organismCode: string
  astPanelId: string
  astPanelName: string
  standard: AstStandard
  plateBarcode: string
  imageQualityStatus: ImageQualityStatus
  mediumLot: string
  createdBy: string
}

export interface DiscLayout {
  id: string
  diskPosition: string
  antibioticCode: string
  antibioticName: string
  discPotency: string
  discLot: string
  discExpiryDate: string
  expectedOnPlate: boolean
}

export type ReaderConfidence = 'high' | 'medium' | 'low' | 'manual'
export type MeasurementSource = 'auto_reader' | 'manual_entry' | 'reader_then_manual' | 'imported'
export type ReviewStatus = 'pending' | 'accepted' | 'rejected' | 'needs_repeat'

export interface DiskMeasurement {
  id: string
  diskPosition: string
  zoneDiameterMm: number | null
  comment: string
  antibioticCode: string
  antibioticName: string
  discPotency: string
  readerConfidence: ReaderConfidence
  measurementSource: MeasurementSource
  manualEdited: boolean
  originalValue: number | null
  correctedValue: number | null
  overrideReason: string
  reviewedBy: string
  reviewedAt: string
  reviewStatus: ReviewStatus
}

interface LimsWorklistDisc { antibioticCode: string; antibioticName?: string; discPotency?: string; plateHint?: string }
interface LimsWorklist {
  accessionId?: string
  accessionNumber?: string
  isolateId?: string
  patientDisplayId?: string
  specimenType?: string
  organismName?: string
  organismCode?: string
  organismGroup?: string
  astPanelId?: string
  astPanelName?: string
  standard?: AstStandard
  expectedDiscs?: LimsWorklistDisc[]
}

interface DiskDiffState {
  plateRecord: PlateRecord
  measurements: DiskMeasurement[]
  discLayout: DiscLayout[]
  setPlateRecord: (patch: Partial<PlateRecord>) => void
  saveMeasurement: (item: Partial<DiskMeasurement> & { id?: string }) => void
  saveDiscLayoutItem: (item: Partial<DiscLayout> & { id?: string }) => void
  listDiscLayout: () => DiscLayout[]
  importLimsWorklistJson: (jsonText: string) => { ok: boolean; message: string }
  validateZoneResultExport: () => string[]
  exportZoneResultJson: () => { payload: Record<string, unknown>; warnings: string[] }
}

const defaultPlateRecord: PlateRecord = {
  id: 'plate-1', accessionNumber: '', patientIdentifier: '', specimenType: '', organismName: '', organismGroup: '', plateSizeMm: 90, imageReference: '', qcStatus: '',
  operatingMode: 'standalone', interpretationAuthority: 'measurement_only', worklistId: '', isolateId: '', externalLisAccessionId: '', externalLisIsolateId: '', organismCode: '',
  astPanelId: '', astPanelName: '', standard: 'EUCAST', plateBarcode: '', imageQualityStatus: 'acceptable', mediumLot: '', createdBy: '',
}

const parseStored = (): Pick<DiskDiffState, 'plateRecord' | 'measurements' | 'discLayout'> => {
  if (typeof localStorage === 'undefined') return { plateRecord: defaultPlateRecord, measurements: [], discLayout: [] }
  try {
    const raw = localStorage.getItem('diskdiff-store')
    if (!raw) return { plateRecord: defaultPlateRecord, measurements: [], discLayout: [] }
    const parsed = JSON.parse(raw) as Partial<DiskDiffState>
    return {
      plateRecord: { ...defaultPlateRecord, ...(parsed.plateRecord ?? {}) },
      measurements: (parsed.measurements ?? []).map((m) => ({
        id: m.id ?? crypto.randomUUID(), diskPosition: m.diskPosition ?? '', zoneDiameterMm: m.zoneDiameterMm ?? null, comment: m.comment ?? '',
        antibioticCode: m.antibioticCode ?? '', antibioticName: m.antibioticName ?? '', discPotency: m.discPotency ?? '', readerConfidence: m.readerConfidence ?? 'manual',
        measurementSource: m.measurementSource ?? 'manual_entry', manualEdited: m.manualEdited ?? false, originalValue: m.originalValue ?? null, correctedValue: m.correctedValue ?? null,
        overrideReason: m.overrideReason ?? '', reviewedBy: m.reviewedBy ?? '', reviewedAt: m.reviewedAt ?? '', reviewStatus: m.reviewStatus ?? 'accepted',
      })),
      discLayout: parsed.discLayout ?? [],
    }
  } catch { return { plateRecord: defaultPlateRecord, measurements: [], discLayout: [] } }
}



type Listener = () => void
let state: DiskDiffState
const listeners = new Set<Listener>()

const initState = (): DiskDiffState => ({
  ...parseStored(),
  setPlateRecord: (patch) => update({ plateRecord: { ...state.plateRecord, ...patch } }),
  saveMeasurement: (item) => {
    const normalized: DiskMeasurement = {
      id: item.id ?? crypto.randomUUID(), diskPosition: item.diskPosition ?? '', zoneDiameterMm: item.zoneDiameterMm ?? null, comment: item.comment ?? '',
      antibioticCode: item.antibioticCode ?? '', antibioticName: item.antibioticName ?? '', discPotency: item.discPotency ?? '',
      readerConfidence: item.readerConfidence ?? 'manual', measurementSource: item.measurementSource ?? 'manual_entry', reviewStatus: item.reviewStatus ?? 'accepted', manualEdited: item.manualEdited ?? false,
      originalValue: item.originalValue ?? null, correctedValue: item.correctedValue ?? null, overrideReason: item.overrideReason ?? '', reviewedBy: item.reviewedBy ?? '', reviewedAt: item.reviewedAt ?? '',
    }
    update({ measurements: state.measurements.filter((m) => m.id !== normalized.id).concat(normalized) })
  },
  saveDiscLayoutItem: (item) => {
    const normalized: DiscLayout = { id: item.id ?? crypto.randomUUID(), diskPosition: item.diskPosition ?? '', antibioticCode: item.antibioticCode ?? '', antibioticName: item.antibioticName ?? '', discPotency: item.discPotency ?? '', discLot: item.discLot ?? '', discExpiryDate: item.discExpiryDate ?? '', expectedOnPlate: item.expectedOnPlate ?? true }
    update({ discLayout: state.discLayout.filter((d) => d.id !== normalized.id).concat(normalized) })
  },
  listDiscLayout: () => state.discLayout,
  importLimsWorklistJson: (jsonText) => {
    try {
      const worklist = JSON.parse(jsonText) as LimsWorklist
      update({
        plateRecord: {
          ...state.plateRecord,
          worklistId: worklist.accessionId ?? '', accessionNumber: worklist.accessionNumber ?? '', patientIdentifier: worklist.patientDisplayId ?? '', specimenType: worklist.specimenType ?? '',
          organismName: worklist.organismName ?? '', organismCode: worklist.organismCode ?? '', organismGroup: worklist.organismGroup ?? '', isolateId: worklist.isolateId ?? '', astPanelId: worklist.astPanelId ?? '', astPanelName: worklist.astPanelName ?? '', standard: worklist.standard ?? state.plateRecord.standard,
          operatingMode: 'medugu_lims_connected',
        },
        discLayout: (worklist.expectedDiscs ?? []).map((disc, idx) => ({ id: `${disc.antibioticCode || 'disc'}-${idx}`, diskPosition: '', antibioticCode: disc.antibioticCode ?? '', antibioticName: disc.antibioticName ?? disc.plateHint ?? '', discPotency: disc.discPotency ?? '', discLot: '', discExpiryDate: '', expectedOnPlate: true })),
      })
      return { ok: true, message: 'Imported LIMS worklist JSON successfully.' }
    } catch {
      return { ok: false, message: 'Failed to parse LIMS worklist JSON.' }
    }
  },
  validateZoneResultExport: () => {
    const w: string[] = []
    if (!state.plateRecord.accessionNumber) w.push('Missing accession number.')
    if (state.plateRecord.operatingMode !== 'standalone' && !state.plateRecord.isolateId) w.push('LIS-connected mode requires isolateId.')
    if (state.plateRecord.operatingMode !== 'standalone' && !state.plateRecord.astPanelId) w.push('LIS-connected mode requires astPanelId.')
    if (state.plateRecord.qcStatus.toLowerCase().includes('reject') || state.plateRecord.qcStatus.toLowerCase().includes('repeat')) w.push('QC status indicates reject image or repeat plate.')
    if (state.measurements.length === 0) w.push('No measurements entered.')
    state.measurements.forEach((m, i) => { if (!m.antibioticCode) w.push(`Measurement ${i + 1} missing antibioticCode.`); if (m.zoneDiameterMm == null || m.zoneDiameterMm < 6 || m.zoneDiameterMm > 50) w.push(`Measurement ${i + 1} has invalid zoneDiameterMm.`); if (m.manualEdited && !m.overrideReason) w.push(`Measurement ${i + 1} manualEdited requires overrideReason.`) })
    return w
  },
  exportZoneResultJson: () => {
    const warnings = state.validateZoneResultExport()
    const payload = { contractVersion: '1.0.0', sourceSystem: 'DISKDIFF_READER', readerDeviceId: 'manual-reader', readerSoftwareVersion: 'DiskDiff Reader v1', operator: state.plateRecord.createdBy || 'unknown', readAt: new Date().toISOString(), accessionId: state.plateRecord.worklistId || state.plateRecord.externalLisAccessionId || '', accessionNumber: state.plateRecord.accessionNumber, isolateId: state.plateRecord.isolateId, astPanelId: state.plateRecord.astPanelId, method: 'disk_diffusion', standard: state.plateRecord.standard, plateBarcode: state.plateRecord.plateBarcode, imageReference: state.plateRecord.imageReference, results: state.measurements.map((m) => ({ antibioticCode: m.antibioticCode, antibioticName: m.antibioticName, discPotency: m.discPotency, diskPosition: m.diskPosition, zoneDiameterMm: m.zoneDiameterMm, readerConfidence: m.readerConfidence, measurementSource: m.measurementSource, manualEdited: m.manualEdited, originalValue: m.originalValue, correctedValue: m.correctedValue, overrideReason: m.overrideReason || null, reviewStatus: m.reviewStatus, reviewedBy: m.reviewedBy, reviewedAt: m.reviewedAt || null, comment: m.comment ?? '' })) }
    return { payload, warnings }
  },
})

const update = (patch: Partial<DiskDiffState>) => {
  state = { ...state, ...patch }
  if (typeof window !== 'undefined') {
    localStorage.setItem('diskdiff-store', JSON.stringify({ plateRecord: state.plateRecord, measurements: state.measurements, discLayout: state.discLayout }))
  }
  listeners.forEach((l) => l())
}

state = initState()

export const useDiskDiffStore = () => state
