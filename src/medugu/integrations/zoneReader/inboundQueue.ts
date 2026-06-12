import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export type ZoneReaderInboundStatus =
  | "pending_review"
  | "accepted"
  | "rejected";

export interface ZoneReaderInboundMessage {
  id: string;
  accessionId: string;
  accessionNumber: string | null;
  isolateId: string;
  astPanelId: string;
  receivedAt: string;
  status: ZoneReaderInboundStatus;
  payload: Json;
}

export async function listPendingZoneReaderMessages(
  accessionId: string,
  isolateId: string,
): Promise<ZoneReaderInboundMessage[]> {
  const { data, error } = await supabase
    .from("zone_reader_inbound_messages")
    .select(
      "id, accession_id, accession_number, isolate_id, ast_panel_id, received_at, status, payload",
    )
    .eq("accession_id", accessionId)
    .eq("isolate_id", isolateId)
    .eq("status", "pending_review")
    .order("received_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id,
    accessionId: row.accession_id,
    accessionNumber: row.accession_number,
    isolateId: row.isolate_id,
    astPanelId: row.ast_panel_id,
    receivedAt: row.received_at,
    status: row.status as ZoneReaderInboundStatus,
    payload: row.payload,
  }));
}

export async function setZoneReaderMessageStatus(
  id: string,
  status: Exclude<ZoneReaderInboundStatus, "pending_review">,
): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("zone_reader_inbound_messages")
    .update({
      status,
      reviewed_at: new Date().toISOString(),
      reviewed_by: auth.user?.id ?? null,
    })
    .eq("id", id)
    .eq("status", "pending_review");

  if (error) throw new Error(error.message);
}
