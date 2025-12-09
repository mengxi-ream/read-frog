import type { Config } from '@/types/config/config'
import type { ApplyResolutionsResult, DiffConflictsResult } from '@/utils/google-drive/conflict-merge'
import { atom } from 'jotai'
import { applyResolutions, detectConflicts } from '@/utils/google-drive/conflict-merge'

export interface UnresolvedConfigs {
  base: Config
  local: Config
  remote: Config
}

type Resolution = 'local' | 'remote'

export const unresolvedConfigsAtom = atom<UnresolvedConfigs | null>(null)
export const resolutionsAtom = atom<Record<string, Resolution>>({})

export const diffConflictsResultAtom = atom<DiffConflictsResult | null>((get) => {
  const unresolvedConfigs = get(unresolvedConfigsAtom)
  if (!unresolvedConfigs)
    return null
  return detectConflicts(unresolvedConfigs.base, unresolvedConfigs.local, unresolvedConfigs.remote)
})

// Derived atom that applies resolutions and returns the result with validation status
export const resolvedConfigResultAtom = atom<ApplyResolutionsResult | null>((get) => {
  const diffConflictsResult = get(diffConflictsResultAtom)
  const resolutions = get(resolutionsAtom)
  if (!diffConflictsResult)
    return null
  // can partially resolved because resolutions are not required to be all conflicts
  return applyResolutions(diffConflictsResult, resolutions)
})

export const resolutionStatusAtom = atom((get) => {
  const diffConflictsResult = get(diffConflictsResultAtom)
  const resolutions = get(resolutionsAtom)
  const resolvedConfig = get(resolvedConfigResultAtom)

  const conflictCount = diffConflictsResult?.conflicts.length ?? 0
  const resolvedCount = Object.keys(resolutions).length
  const allResolved = diffConflictsResult?.conflicts.every(c => resolutions[c.path.join('.')]) ?? true

  return {
    conflictCount,
    resolvedCount,
    allResolved,
    hasValidationError: resolvedConfig?.validationError != null,
    validationError: resolvedConfig?.validationError ?? null,
    isValid: allResolved && resolvedConfig?.validationError == null,
  }
})

export const selectResolutionAtom = atom(
  null,
  (_get, set, { pathKey, resolution }: { pathKey: string, resolution: Resolution }) => {
    set(resolutionsAtom, prev => ({ ...prev, [pathKey]: resolution }))
  },
)

export const resetResolutionAtom = atom(null, (_get, set, pathKey: string) => {
  set(resolutionsAtom, (prev) => {
    const next = { ...prev }
    delete next[pathKey]
    return next
  })
})

export const selectAllLocalAtom = atom(null, (get, set) => {
  const diffConflictsResult = get(diffConflictsResultAtom)
  if (!diffConflictsResult)
    return
  const resolutions: Record<string, Resolution> = {}
  for (const c of diffConflictsResult.conflicts) {
    resolutions[c.path.join('.')] = 'local'
  }
  set(resolutionsAtom, resolutions)
})

export const selectAllRemoteAtom = atom(null, (get, set) => {
  const diffResult = get(diffConflictsResultAtom)
  if (!diffResult)
    return
  const resolutions: Record<string, Resolution> = {}
  for (const c of diffResult.conflicts) {
    resolutions[c.path.join('.')] = 'remote'
  }
  set(resolutionsAtom, resolutions)
})
