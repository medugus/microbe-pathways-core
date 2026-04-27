// Browser-phase New Accession intake dialog.
// Pure UI: composes a new Accession aggregate and hands it to the store via
// meduguActions.upsertAccession. No clinical rule logic lives here.

import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { meduguActions, useMeduguState } from "../store/useAccessionStore";
import { newAccessionId } from "../domain/ids";
import { Priority, ReleaseState, Sex, WorkflowStage } from "../domain/enums";
import { SPECIMEN_FAMILIES, getFamily } from "../config/specimenFamilies";
import {
  BREAKPOINT_VERSION,
  BUILD_VERSION,
  EXPORT_VERSION,
  RULE_VERSION,
} from "../domain/versions";
import type { Accession, Patient } from "../domain/types";
import { NewPatientFields } from "./accession/NewPatientFields";
import { ExistingPatientSelector } from "./accession/ExistingPatientSelector";
import { AccessionMetadataFields } from "./accession/AccessionMetadataFields";
import { NewAccessionSpecimenFields } from "./accession/NewAccessionSpecimenFields";
import { NewAccessionBloodSetup } from "./accession/NewAccessionBloodSetup";
import { AccessionTimestamps } from "./accession/AccessionTimestamps";
import { SubmitBlockedReason } from "./accession/SubmitBlockedReason";
import {
  canSubmitNewAccessionForm,
  getFirstSubtypeForFamily,
  getNewAccessionSubmitBlockedReason,
} from "./accession/newAccessionFormLogic";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

type Mode = "new" | "existing";

function localISO(d: Date): string {
  // yyyy-MM-ddTHH:mm for <input type="datetime-local">
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function NewAccessionDialog({ open, onOpenChange }: Props) {
  const state = useMeduguState();
  const [mode, setMode] = useState<Mode>("new");

  // Build a unique-by-MRN patient list from existing accessions.
  const existingPatients = useMemo(() => {
    const map = new Map<string, Patient>();
    for (const id of state.accessionOrder) {
      const a = state.accessions[id];
      if (a && !map.has(a.patient.mrn)) map.set(a.patient.mrn, a.patient);
    }
    return Array.from(map.values());
  }, [state.accessions, state.accessionOrder]);

  // Form state
  const [existingMrn, setExistingMrn] = useState<string>("");
  const [givenName, setGivenName] = useState("");
  const [familyName, setFamilyName] = useState("");
  const [mrn, setMrn] = useState("");
  const [sex, setSex] = useState<Sex>(Sex.Unknown);
  const [ward, setWard] = useState("");
  const [accessionNumber, setAccessionNumber] = useState(newAccessionId());
  const [priority, setPriority] = useState<Priority>(Priority.Routine);
  const [familyCode, setFamilyCode] = useState<string>(SPECIMEN_FAMILIES[0].code);
  const [subtypeCode, setSubtypeCode] = useState<string>(SPECIMEN_FAMILIES[0].subtypes[0].code);
  const [collectedAt, setCollectedAt] = useState<string>(localISO(new Date()));
  const [receivedAt, setReceivedAt] = useState<string>(localISO(new Date()));
  const [bloodPreset, setBloodPreset] = useState<string>("STANDARD_ADULT");
  const [bloodSources, setBloodSources] = useState<string[]>([]);

  const isBlood = familyCode === "BLOOD";
  const subtypes = getFamily(familyCode)?.subtypes ?? [];
  const accessionExists = !!state.accessions[accessionNumber];

  useEffect(() => {
    if (isBlood) return;
    if (bloodSources.length === 0 && bloodPreset === "STANDARD_ADULT") return;
    setBloodSources([]);
    setBloodPreset("STANDARD_ADULT");
  }, [bloodPreset, bloodSources.length, isBlood]);

  function reset() {
    setMode("new");
    setExistingMrn("");
    setGivenName("");
    setFamilyName("");
    setMrn("");
    setSex(Sex.Unknown);
    setWard("");
    setAccessionNumber(newAccessionId());
    setPriority(Priority.Routine);
    setFamilyCode(SPECIMEN_FAMILIES[0].code);
    setSubtypeCode(SPECIMEN_FAMILIES[0].subtypes[0].code);
    const nowL = localISO(new Date());
    setCollectedAt(nowL);
    setReceivedAt(nowL);
    setBloodPreset("STANDARD_ADULT");
    setBloodSources([]);
  }

  const canSubmit = canSubmitNewAccessionForm({
    accessionNumber,
    accessionExists,
    familyCode,
    subtypeCode,
    isBlood,
    bloodSourcesCount: bloodSources.length,
    mode,
    existingMrn,
    givenName,
    familyName,
    mrn,
  });
  const mrnMissing = mode === "new" && mrn.trim().length === 0;
  const existingMrnMissing = mode === "existing" && existingMrn.trim().length === 0;
  const submitBlockedReason = getNewAccessionSubmitBlockedReason({
    accessionNumber,
    accessionExists,
    familyCode,
    subtypeCode,
    isBlood,
    bloodSourcesCount: bloodSources.length,
    mode,
    existingMrn,
    givenName,
    familyName,
    mrn,
  });

  function handleFamilyChange(nextFamilyCode: string) {
    const wasBlood = familyCode === "BLOOD";
    setFamilyCode(nextFamilyCode);
    const first = getFirstSubtypeForFamily(nextFamilyCode);
    if (first) setSubtypeCode(first);
    if (wasBlood && nextFamilyCode !== "BLOOD") {
      setBloodSources([]);
      setBloodPreset("STANDARD_ADULT");
    }
  }

  function handleToggleBloodSource(code: string) {
    setBloodSources((prev) =>
      prev.includes(code) ? prev.filter((currentCode) => currentCode !== code) : [...prev, code],
    );
  }

  function handleSubmit() {
    if (!canSubmit) return;

    let patient: Patient;
    if (mode === "existing") {
      const found = existingPatients.find((p) => p.mrn === existingMrn);
      if (!found) return;
      patient = { ...found, ward: ward.trim() || found.ward };
    } else {
      patient = {
        mrn: mrn.trim(),
        givenName: givenName.trim(),
        familyName: familyName.trim(),
        sex,
        ward: ward.trim() || undefined,
      };
    }

    const nowIso = new Date().toISOString();
    const accession: Accession = {
      id: accessionNumber,
      accessionNumber,
      createdAt: nowIso,
      updatedAt: nowIso,
      workflowStatus: WorkflowStage.Registered,
      stage: WorkflowStage.Registered,
      priority,
      ruleVersion: RULE_VERSION.version,
      breakpointVersion: BREAKPOINT_VERSION,
      exportVersion: EXPORT_VERSION,
      buildVersion: BUILD_VERSION,
      patient,
      specimen: {
        familyCode,
        subtypeCode: isBlood ? (bloodSources[0] ?? subtypeCode) : subtypeCode,
        collectedAt: collectedAt ? new Date(collectedAt).toISOString() : undefined,
        receivedAt: receivedAt ? new Date(receivedAt).toISOString() : undefined,
        ...(isBlood ? { details: { sources: bloodSources } } : {}),
      },
      specimenAssessments: [],
      microscopy: [],
      isolates: [],
      ast: [],
      interpretiveComments: [],
      phoneOuts: [],
      stewardship: [],
      ipc: [],
      validation: [],
      release: { state: ReleaseState.Draft, reportVersion: 0 },
      audit: [
        {
          id: `aud_${Date.now().toString(36)}`,
          at: nowIso,
          actor: "local",
          action: "accession.created",
          section: "intake",
          newValue: {
            accessionNumber,
            mrn: patient.mrn,
            familyCode,
            subtypeCode: isBlood ? (bloodSources[0] ?? subtypeCode) : subtypeCode,
            mode,
            ...(isBlood ? { bloodPreset, bloodSources } : {}),
          },
        },
      ],
    };

    meduguActions.upsertAccession(accession);
    meduguActions.setActive(accession.id);
    onOpenChange(false);
    reset();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>New accession</DialogTitle>
          <DialogDescription>
            Browser-phase intake. Saves locally and pushes to your tenant on the next sync. No EMR
            or patient-master integration.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="new">New patient</TabsTrigger>
            <TabsTrigger value="existing" disabled={existingPatients.length === 0}>
              Existing patient ({existingPatients.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="new" className="space-y-3 pt-3">
            <NewPatientFields
              givenName={givenName}
              familyName={familyName}
              mrn={mrn}
              sex={sex}
              mrnMissing={mrnMissing}
              onGivenNameChange={setGivenName}
              onFamilyNameChange={setFamilyName}
              onMrnChange={setMrn}
              onSexChange={setSex}
            />
          </TabsContent>

          <TabsContent value="existing" className="space-y-3 pt-3">
            <ExistingPatientSelector
              existingMrn={existingMrn}
              existingMrnMissing={existingMrnMissing}
              existingPatients={existingPatients}
              onExistingMrnChange={setExistingMrn}
            />
          </TabsContent>
        </Tabs>

        <div className="grid grid-cols-2 gap-3 border-t border-border pt-3">
          <AccessionMetadataFields
            ward={ward}
            accessionNumber={accessionNumber}
            accessionExists={accessionExists}
            priority={priority}
            onWardChange={setWard}
            onAccessionNumberChange={setAccessionNumber}
            onAutoAccessionNumber={() => setAccessionNumber(newAccessionId())}
            onPriorityChange={setPriority}
          />

          <NewAccessionSpecimenFields
            familyCode={familyCode}
            subtypeCode={subtypeCode}
            subtypes={subtypes}
            showSubtype={!isBlood}
            onFamilyChange={handleFamilyChange}
            onSubtypeChange={setSubtypeCode}
          />

          {isBlood && (
            <NewAccessionBloodSetup
              bloodPreset={bloodPreset}
              bloodSources={bloodSources}
              onBloodPresetChange={setBloodPreset}
              onToggleBloodSource={handleToggleBloodSource}
            />
          )}

          <AccessionTimestamps
            collectedAt={collectedAt}
            receivedAt={receivedAt}
            onCollectedAtChange={setCollectedAt}
            onReceivedAtChange={setReceivedAt}
          />
        </div>

        <DialogFooter>
          <SubmitBlockedReason canSubmit={canSubmit} submitBlockedReason={submitBlockedReason} />
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            Create accession
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
