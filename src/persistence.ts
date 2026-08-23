const STORAGE_KEY = 'better-planner-state';

export interface BetterPlannerLocalState {
  version: 1;
  dayOrder: { [dayKey: string]: string[] };
}

const emptyState = (): BetterPlannerLocalState => ({ version: 1, dayOrder: {} });

export const loadState = async (): Promise<BetterPlannerLocalState> => {
  const raw = await PluginAPI.loadSyncedData(STORAGE_KEY);
  if (!raw) return emptyState();
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.version === 1 && parsed.dayOrder) return parsed as BetterPlannerLocalState;
  } catch {
    // malformed persisted data — start fresh rather than throwing
  }
  return emptyState();
};

export const saveState = async (state: BetterPlannerLocalState): Promise<void> => {
  await PluginAPI.persistDataSynced(JSON.stringify(state), STORAGE_KEY);
};

/** Drops ids no longer present in the live set, appends new/unordered ids at the end. */
export const reconcileOrder = (order: string[] | undefined, liveIds: string[]): string[] => {
  const liveSet = new Set(liveIds);
  const kept = (order ?? []).filter((id) => liveSet.has(id));
  const known = new Set(kept);
  const appended = liveIds.filter((id) => !known.has(id));
  return [...kept, ...appended];
};
