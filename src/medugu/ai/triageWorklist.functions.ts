// Worklist triage server function — AI-assisted bucketing of open cases.
//
// Purpose
// -------
// Given a batch of compact, de-identified case summaries (already derived
// client-side from the operational dashboard), ask the AI to bucket each one
// into auto / glance / work, with a one-line rationale.
//
// Regulatory posture
// ------------------
// The model is FORBIDDEN from recommending therapy, organism IDs, AST
// interpretations, or any clinical action. It only triages WORKLOAD: how
// much human attention each case probably needs. The bench scientist remains
// the decision maker; the chip is a UI hint, not a sign-off.
//
// Audit
// -----
// One audit_event row per scored case (entity = "ai_triage"), best-effort,
// matching the ai_assist pattern. Failure to audit must not break UX.
//
// Determinism / safety
// --------------------
// - Caller passes pre-derived summaries; no PHI beyond what the worklist
//   already shows in the UI.
// - Output is forced to a strict JSON shape via response_format json_object,
//   then validated with zod. Anything malformed falls back to "glance" so we
//   never accidentally suggest "auto-release" on a parser error.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-3-flash-preview";

const SYSTEM_PROMPT =
  "You are a microbiology lab WORKLOAD triage assistant. You DO NOT make clinical decisions. " +
  "For each case summary you receive, classify how much human attention it likely needs:\n" +
  '- "auto" = looks routine, the senior scientist can probably skim and release.\n' +
  '- "glance" = needs a quick human look (mild flag, easy fix).\n' +
  '- "work" = needs real bench / consultant work before anything can move.\n\n' +
  "STRICT RULES:\n" +
  "- Do NOT recommend antibiotics, organisms, AST interpretations, IPC actions, or any clinical step.\n" +
  "- Do NOT invent data not present in the summary.\n" +
  "- If a case has any critical-priority flag, IPC immediate signal, unacknowledged phone-out, or release blocker, it is at minimum \"glance\" and usually \"work\".\n" +
  "- Rationale must be ONE short sentence describing WORKLOAD only (e.g. \"AST complete, no blockers\"), max 18 words, no clinical advice.\n\n" +
  'Respond with JSON of shape: {"results":[{"id":"<case id>","bucket":"auto|glance|work","rationale":"..."}]}. ' +
  "Include exactly one result per input case, preserving the given ids.";

const CaseInputSchema = z.object({
  id: z.string().min(1).max(120),
  summary: z.string().min(1).max(800),
});

const InputSchema = z.object({
  cases: z.array(CaseInputSchema).min(1).max(40),
});

const BucketSchema = z.enum(["auto", "glance", "work"]);

const ResultSchema = z.object({
  id: z.string(),
  bucket: BucketSchema,
  rationale: z.string().max(240),
});

const ResponseShape = z.object({
  results: z.array(ResultSchema),
});

export type TriageBucket = z.infer<typeof BucketSchema>;

export interface TriageScored {
  id: string;
  bucket: TriageBucket;
  rationale: string;
}

export interface TriageBatchResult {
  ok: boolean;
  scored: TriageScored[];
  reason?: string;
  model?: string;
}

function isAiAssistEnabled(): boolean {
  const v = (process.env.AI_ASSIST_ENABLED ?? "1").toLowerCase();
  return v === "1" || v === "true";
}

export const triageWorklist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { cases: Array<{ id: string; summary: string }>; accessionRowIds?: Record<string, string> }) =>
    z
      .object({
        cases: InputSchema.shape.cases,
        // Optional map of case-id -> accession DB row id, used only for audit
        // tenant scoping. Audit is skipped for unmapped ids.
        accessionRowIds: z.record(z.string(), z.string().uuid()).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<TriageBatchResult> => {
    if (!isAiAssistEnabled()) {
      return { ok: false, scored: [], reason: "AI assist is disabled by configuration." };
    }
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return { ok: false, scored: [], reason: "AI gateway is not configured." };
    }

    const userPayload = {
      cases: data.cases.map((c) => ({ id: c.id, summary: c.summary })),
    };

    let parsed: z.infer<typeof ResponseShape> | null = null;
    try {
      const resp = await fetch(GATEWAY_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: DEFAULT_MODEL,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: JSON.stringify(userPayload) },
          ],
          response_format: { type: "json_object" },
          stream: false,
        }),
      });

      if (resp.status === 429) {
        return { ok: false, scored: [], reason: "AI rate limit reached. Please try again in a moment." };
      }
      if (resp.status === 402) {
        return { ok: false, scored: [], reason: "AI credits exhausted. Add credits in workspace settings." };
      }
      if (!resp.ok) {
        const body = await resp.text().catch(() => "");
        // eslint-disable-next-line no-console
        console.error("[triageWorklist] gateway error", resp.status, body);
        return { ok: false, scored: [], reason: `AI gateway error (${resp.status}).` };
      }

      const json = (await resp.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const raw = json.choices?.[0]?.message?.content?.trim() ?? "";
      if (!raw) {
        return { ok: false, scored: [], reason: "AI returned no content." };
      }
      const obj = JSON.parse(raw);
      parsed = ResponseShape.parse(obj);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[triageWorklist] failed", err);
      return { ok: false, scored: [], reason: "AI triage request failed." };
    }

    // Reconcile: ensure exactly one entry per input id; missing/bad rows fall
    // back to "glance" so we never silently suggest "auto" by omission.
    const byId = new Map<string, TriageScored>();
    for (const r of parsed.results) byId.set(r.id, r);
    const scored: TriageScored[] = data.cases.map((c) => {
      const hit = byId.get(c.id);
      if (hit) return hit;
      return { id: c.id, bucket: "glance", rationale: "AI did not score this case; please review." };
    });

    // Best-effort audit, one row per scored case where we know the tenant.
    try {
      const { supabase, userId } = context;
      const accessionRowIds = data.accessionRowIds ?? {};
      const tenantCache = new Map<string, string | null>();
      for (const item of scored) {
        const rowId = accessionRowIds[item.id];
        if (!rowId) continue;
        let tenantId = tenantCache.get(rowId) ?? null;
        if (!tenantCache.has(rowId)) {
          const { data: row } = await supabase
            .from("accessions")
            .select("tenant_id")
            .eq("id", rowId)
            .maybeSingle();
          tenantId = (row?.tenant_id as string | undefined) ?? null;
          tenantCache.set(rowId, tenantId);
        }
        if (!tenantId) continue;
        await (supabase.from("audit_event") as any).insert({
          tenant_id: tenantId,
          actor_user_id: userId,
          actor_label: "ai_triage",
          action: "ai_triage.score",
          entity: "ai_triage",
          entity_id: rowId,
          field: "worklist_triage_score",
          old_value: null,
          new_value: { bucket: item.bucket, rationale: item.rationale, model: DEFAULT_MODEL },
          reason: null,
        });
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("[triageWorklist] audit write failed", err);
    }

    return { ok: true, scored, model: DEFAULT_MODEL };
  });
