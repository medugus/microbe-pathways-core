import type { Accession, MeduguState } from "../domain/types";
type EmitFn = (changedAccessionIds?: string[]) => void;

type StoreAccess = {
  getState: () => MeduguState;
  setState: (next: MeduguState) => void;
  emit: EmitFn;
};

type HydrateCloudFn = (tenantId: string) => Promise<{ accessions: Accession[] }>;
type SetAuditContextFn = (input: { tenantId: string | null; actorLabel?: string | null }) => void;

export function createAccessionMutations(
  store: StoreAccess,
  deps: {
    freshSeedState: () => MeduguState;
    emptyState: () => MeduguState;
    hydrateFromCloud: HydrateCloudFn;
    setAuditContext: SetAuditContextFn;
    setActiveTenantId: (tenantId: string | null) => void;
    clearPushTimers: () => void;
  },
) {
  return {
    setActive(id: string | null) {
      const s = store.getState();
      store.setState({ ...s, activeAccessionId: id });
      store.emit();
    },

    upsertAccession(a: Accession) {
      const s = store.getState();
      const exists = !!s.accessions[a.id];
      store.setState({
        ...s,
        accessions: {
          ...s.accessions,
          [a.id]: { ...a, updatedAt: new Date().toISOString() },
        },
        accessionOrder: exists ? s.accessionOrder : [...s.accessionOrder, a.id],
      });
      store.emit([a.id]);
    },

    removeAccession(id: string) {
      const s = store.getState();
      const next = { ...s.accessions };
      delete next[id];
      store.setState({
        ...s,
        accessions: next,
        accessionOrder: s.accessionOrder.filter((x) => x !== id),
        activeAccessionId: s.activeAccessionId === id ? null : s.activeAccessionId,
      });
      store.emit();
    },

    resetToSeed() {
      const seeded = deps.freshSeedState();
      store.setState(seeded);
      store.emit(seeded.accessionOrder);
    },

    async hydrateFromTenant(tenantId: string, actorLabel?: string | null) {
      deps.setActiveTenantId(tenantId);
      deps.setAuditContext({ tenantId, actorLabel: actorLabel ?? null });
      const { accessions } = await deps.hydrateFromCloud(tenantId);
      const map: Record<string, Accession> = {};
      const order: string[] = [];
      for (const a of accessions) {
        map[a.id] = a;
        order.push(a.id);
      }
      store.setState({
        ...store.getState(),
        accessions: map,
        accessionOrder: order,
        activeAccessionId: order[0] ?? null,
      });
      store.emit();
    },

    detachTenant() {
      deps.setActiveTenantId(null);
      deps.setAuditContext({ tenantId: null });
      deps.clearPushTimers();
      store.setState(deps.emptyState());
      store.emit();
    },
  };
}
