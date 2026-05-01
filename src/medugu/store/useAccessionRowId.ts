// useAccessionRowId — resolves the cloud postgres row id for an accession code.
//
// Several surfaces (release history, amendment AI assist, AMS request AI
// assist) need the database row id rather than the human-readable accession
// number. This hook encapsulates the lookup so we don't duplicate the
// fetch + cancellation pattern in every section.

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useAccessionRowId(accessionCode: string | null | undefined): string | null {
  const [rowId, setRowId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!accessionCode) {
      setRowId(null);
      return;
    }
    void supabase
      .from("accessions")
      .select("id")
      .eq("accession_code", accessionCode)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setRowId((data?.id as string | null) ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [accessionCode]);

  return rowId;
}
