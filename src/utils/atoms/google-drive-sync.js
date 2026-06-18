import { atom } from "jotai";
import { applyResolutions, detectConflicts } from "@/utils/google-drive/conflict-merge";
export const unresolvedConfigsAtom = atom(null);
export const resolutionsAtom = atom({});
export const diffConflictsResultAtom = atom((get) => {
    const unresolvedConfigs = get(unresolvedConfigsAtom);
    if (!unresolvedConfigs)
        return null;
    return detectConflicts(unresolvedConfigs.base, unresolvedConfigs.local, unresolvedConfigs.remote);
});
// Derived atom that applies resolutions and returns the result with validation status
export const resolvedConfigResultAtom = atom((get) => {
    const diffConflictsResult = get(diffConflictsResultAtom);
    const resolutions = get(resolutionsAtom);
    if (!diffConflictsResult)
        return null;
    // can partially resolved because resolutions are not required to be all conflicts
    return applyResolutions(diffConflictsResult, resolutions);
});
export const resolutionStatusAtom = atom((get) => {
    const diffConflictsResult = get(diffConflictsResultAtom);
    const resolutions = get(resolutionsAtom);
    const resolvedConfig = get(resolvedConfigResultAtom);
    const conflictCount = diffConflictsResult?.conflicts.length ?? 0;
    const resolvedCount = Object.keys(resolutions).length;
    const allResolved = diffConflictsResult?.conflicts.every(c => resolutions[c.path.join(".")]) ?? true;
    return {
        conflictCount,
        resolvedCount,
        allResolved,
        hasValidationError: resolvedConfig?.validationError != null,
        validationError: resolvedConfig?.validationError ?? null,
        isValid: allResolved && resolvedConfig?.validationError == null,
    };
});
export const selectResolutionAtom = atom(null, (_get, set, { pathKey, resolution }) => {
    set(resolutionsAtom, prev => ({ ...prev, [pathKey]: resolution }));
});
export const resetResolutionAtom = atom(null, (_get, set, pathKey) => {
    set(resolutionsAtom, (prev) => {
        const next = { ...prev };
        delete next[pathKey];
        return next;
    });
});
export const selectAllLocalAtom = atom(null, (get, set) => {
    const diffConflictsResult = get(diffConflictsResultAtom);
    if (!diffConflictsResult)
        return;
    const resolutions = {};
    for (const c of diffConflictsResult.conflicts) {
        resolutions[c.path.join(".")] = "local";
    }
    set(resolutionsAtom, resolutions);
});
export const selectAllRemoteAtom = atom(null, (get, set) => {
    const diffResult = get(diffConflictsResultAtom);
    if (!diffResult)
        return;
    const resolutions = {};
    for (const c of diffResult.conflicts) {
        resolutions[c.path.join(".")] = "remote";
    }
    set(resolutionsAtom, resolutions);
});
