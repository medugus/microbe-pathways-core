// Demo role view — browser-phase-only override of the "active view" role.
//
// CRITICAL: This is UI-only. It does NOT change roles in the DB, does NOT
// bypass RLS, and does NOT alter clinical workflow rules. All server-side
// authorisation continues to read the user_roles table via has_role().
//
// Purpose: let an operator preview "what does the screen look like as an
// AMS pharmacist?" without re-provisioning accounts. Persisted in
// localStorage so the choice survives a refresh, scoped per browser.

import { useEffect, useState, useCallback } from "react";

const STORAGE_KEY = "medugu.demo.activeRoleView.v1";

export type DemoRoleView = string | null; // role code from ROLE_CATALOG, or null = "all assigned"

function readStored(): DemoRoleView {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v && v.length > 0 ? v : null;
  } catch {
    return null;
  }
}

function writeStored(v: DemoRoleView) {
  if (typeof window === "undefined") return;
  try {
    if (v === null) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, v);
  } catch {
    /* ignore quota errors */
  }
}

export function useDemoRoleView(): {
  activeView: DemoRoleView;
  setActiveView: (v: DemoRoleView) => void;
} {
  const [activeView, setActiveViewState] = useState<DemoRoleView>(() => readStored());

  // Cross-tab sync.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setActiveViewState(readStored());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setActiveView = useCallback((v: DemoRoleView) => {
    writeStored(v);
    setActiveViewState(v);
  }, []);

  return { activeView, setActiveView };
}
