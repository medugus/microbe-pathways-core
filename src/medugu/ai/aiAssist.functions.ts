// AI assist server function — generic, audited gateway to Lovable AI.
//
// Purpose
// -------
// This is the foundation for the AI-native review surface (the "Copilot")
// without exposing any clinical-decision-driving features yet. It is feature-
// flagged, audit-logged, and currently scoped to language assistance over
// user-typed text (e.g. polishing an amendment reason). The same wrapper will
// power future surfaces (smart comments, case summaries) once each surface
// passes its own regulatory review.
//
// Non-goals (intentional, documented for future contributors)
// -----------------------------------------------------------
// - Does NOT recommend antibiotics, organism IDs, or interpretive comments.
// - Does NOT auto-apply output anywhere — the UI must keep a human-in-the-loop
//   "review and accept" step for everything written through this surface.
// - Does NOT bypass RLS — all writes use the authenticated supabase client
//   from requireSupabaseAuth.
//
// Audit
// -----
// Every successful call writes one audit_event row (entity = "ai_assist") with
// the task, model, prompt context, and response. This is the regulatory paper
// trail that the future Copilot will reuse.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-3-flash-preview";

/** Tasks currently allowed through the AI assist surface. Add new tasks here
 *  only after a regulatory review of that surface. */
const ALLOWED_TASKS = ["amendment_reason_polish"] as const;
type AssistTask = (typeof ALLOWED_TASKS)[number];

/** Per-task system prompts. Kept on the server so the client cannot tamper. */
const SYSTEM_PROMPTS: Record<AssistTask, string> = {
  amendment_reason_polish:
    "You are a clinical laboratory documentation assistant. The user is writing the REASON for amending a previously released microbiology report. " +
    "Rewrite their draft as ONE concise, professional sentence (max 30 words) suitable for an immutable audit record. " +
    "Preserve every clinical fact and identifier exactly as written — do not invent organisms, antibiotics, susceptibilities, dates, or patient details. " +
    "Do not add interpretation, recommendations, or clinical advice. Output the rewritten sentence only, with no preamble, quotes, or markdown.",
};

export interface AiAssistResult {
  ok: boolean;
  /** Generated text. Empty string when ok=false. */
  text: string;
  /** Reason when ok=false (rate limit, credits, disabled, validation). */
  reason?: string;
  /** Model that produced the output (for audit / UI footer). */
  model?: string;
}

/** Feature-flag read per request. Default OFF — opt-in via env. */
function isAiAssistEnabled(): boolean {
  const v = (process.env.AI_ASSIST_ENABLED ?? "").toLowerCase();
  return v === "1" || v === "true";
}

export const aiAssist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { task: AssistTask; draft: string; accessionRowId?: string }) =>
    z
      .object({
        task: z.enum(ALLOWED_TASKS),
        // Bound the input — no novels, no empty strings.
        draft: z.string().min(2).max(2000),
        accessionRowId: z.string().uuid().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<AiAssistResult> => {
    if (!isAiAssistEnabled()) {
      return { ok: false, text: "", reason: "AI assist is disabled by configuration." };
    }
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return { ok: false, text: "", reason: "AI gateway is not configured." };
    }

    const system = SYSTEM_PROMPTS[data.task];
    const model = DEFAULT_MODEL;

    let text = "";
    try {
      const resp = await fetch(GATEWAY_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: system },
            { role: "user", content: data.draft },
          ],
          stream: false,
        }),
      });

      if (resp.status === 429) {
        return { ok: false, text: "", reason: "AI rate limit reached. Please try again in a moment." };
      }
      if (resp.status === 402) {
        return { ok: false, text: "", reason: "AI credits exhausted. Add credits in workspace settings." };
      }
      if (!resp.ok) {
        const body = await resp.text().catch(() => "");
        // eslint-disable-next-line no-console
        console.error("[aiAssist] gateway error", resp.status, body);
        return { ok: false, text: "", reason: `AI gateway error (${resp.status}).` };
      }

      const json = (await resp.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      text = json.choices?.[0]?.message?.content?.trim() ?? "";
      if (!text) {
        return { ok: false, text: "", reason: "AI returned no content." };
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[aiAssist] threw", err);
      return { ok: false, text: "", reason: "AI request failed." };
    }

    // Best-effort audit. Failure here MUST NOT break the user-facing flow.
    // Tenant scoping: prefer the accession's tenant when given (matches the
    // RLS policy on audit_event); otherwise skip the audit row rather than
    // guess a tenant.
    try {
      const { supabase, userId } = context;
      let tenantId: string | null = null;
      if (data.accessionRowId) {
        const { data: row } = await supabase
          .from("accessions")
          .select("tenant_id")
          .eq("id", data.accessionRowId)
          .maybeSingle();
        tenantId = (row?.tenant_id as string | undefined) ?? null;
      }
      if (tenantId) {
        await (supabase.from("audit_event") as any).insert({
          tenant_id: tenantId,
          actor_user_id: userId,
          actor_label: "ai_assist",
          action: "ai_assist.suggest",
          entity: "ai_assist",
          entity_id: data.accessionRowId ?? null,
          field: data.task,
          old_value: { draft: data.draft },
          new_value: { suggestion: text, model },
          reason: null,
        });
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("[aiAssist] audit write failed", err);
    }

    return { ok: true, text, model };
  });
