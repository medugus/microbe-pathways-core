// Browser-phase New Accession intake dialog.
// Pure UI: composes a new Accession aggregate and hands it to the store via
// meduguActions.upsertAccession. No clinical rule logic lives here.

import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  const [subtypeCode, setSubtypeCode] = useState<string>(
    SPECIMEN_FAMILIES[0].subtypes[0].code,
  );
  const [collectedAt, setCollectedAt] = useState<string>(localISO(new Date()));
  const [receivedAt, setReceivedAt] = useState<string>(localISO(new Date()));

  const subtypes = getFamily(familyCode)?.subtypes ?? [];

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
  }

  const canSubmit =
    accessionNumber.trim().length > 0 &&
    !state.accessions[accessionNumber] &&
    familyCode &&
    subtypeCode &&
    (mode === "existing"
      ? !!existingMrn
      : givenName.trim().length > 0 && familyName.trim().length > 0 && mrn.trim().length > 0);

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
        subtypeCode,
        collectedAt: collectedAt ? new Date(collectedAt).toISOString() : undefined,
        receivedAt: receivedAt ? new Date(receivedAt).toISOString() : undefined,
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
            subtypeCode,
            mode,
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
            Browser-phase intake. Saves locally and pushes to your tenant on the next sync. No EMR or
            patient-master integration.
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
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="given">Given name</Label>
                <Input id="given" value={givenName} onChange={(e) => setGivenName(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="family">Family name</Label>
                <Input id="family" value={familyName} onChange={(e) => setFamilyName(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="mrn">MRN / Identifier</Label>
                <Input id="mrn" value={mrn} onChange={(e) => setMrn(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Sex</Label>
                <Select value={sex} onValueChange={(v) => setSex(v as Sex)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(Sex).map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="existing" className="space-y-3 pt-3">
            <div className="space-y-1">
              <Label>Patient</Label>
              <Select value={existingMrn} onValueChange={setExistingMrn}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an existing patient" />
                </SelectTrigger>
                <SelectContent>
                  {existingPatients.map((p) => (
                    <SelectItem key={p.mrn} value={p.mrn}>
                      {p.familyName}, {p.givenName} — MRN {p.mrn}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </TabsContent>
        </Tabs>

        <div className="grid grid-cols-2 gap-3 border-t border-border pt-3">
          <div className="space-y-1">
            <Label htmlFor="ward">Ward / location</Label>
            <Input id="ward" value={ward} onChange={(e) => setWard(e.target.value)} placeholder="e.g. ICU-3" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="acc">Accession number</Label>
            <div className="flex gap-2">
              <Input
                id="acc"
                value={accessionNumber}
                onChange={(e) => setAccessionNumber(e.target.value.trim())}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAccessionNumber(newAccessionId())}
              >
                Auto
              </Button>
            </div>
            {state.accessions[accessionNumber] && (
              <p className="text-[11px] text-destructive">Number already in use.</p>
            )}
          </div>

          <div className="space-y-1">
            <Label>Priority</Label>
            <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.values(Priority).map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Specimen family</Label>
            <Select
              value={familyCode}
              onValueChange={(v) => {
                setFamilyCode(v);
                const first = getFamily(v)?.subtypes[0]?.code;
                if (first) setSubtypeCode(first);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SPECIMEN_FAMILIES.map((f) => (
                  <SelectItem key={f.code} value={f.code}>
                    {f.display}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1 col-span-2">
            <Label>Specimen subtype</Label>
            <Select value={subtypeCode} onValueChange={setSubtypeCode}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {subtypes.map((s) => (
                  <SelectItem key={s.code} value={s.code}>
                    {s.display}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="collected">Collection datetime</Label>
            <Input
              id="collected"
              type="datetime-local"
              value={collectedAt}
              onChange={(e) => setCollectedAt(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="received">Received datetime</Label>
            <Input
              id="received"
              type="datetime-local"
              value={receivedAt}
              onChange={(e) => setReceivedAt(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
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
