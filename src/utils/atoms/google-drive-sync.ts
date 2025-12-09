import type { Config } from '@/types/config/config'
import type { ApplyResolutionsResult, ChangeDiffResult } from '@/utils/google-drive/conflict-merge'
import { atom } from 'jotai'
import { applyResolutions, detectChanges } from '@/utils/google-drive/conflict-merge'

export interface UnresolvedData {
  base: Config
  local: Config
  remote: Config
}

type Resolution = 'local' | 'remote'

export const unresolvedDataAtom = atom<UnresolvedData | null>(null)
export const resolutionsAtom = atom<Record<string, Resolution>>({})

export const diffResultAtom = atom<ChangeDiffResult | null>((get) => {
  const unresolvedData = get(unresolvedDataAtom)
  if (!unresolvedData)
    return null
  return detectChanges(unresolvedData.base, unresolvedData.local, unresolvedData.remote)
})

// Derived atom that applies resolutions and returns the result with validation status
export const resolvedConfigAtom = atom<ApplyResolutionsResult | null>((get) => {
  const diffResult = get(diffResultAtom)
  const resolutions = get(resolutionsAtom)
  if (!diffResult)
    return null
  return applyResolutions(diffResult, resolutions)
})

export const resolutionStatusAtom = atom((get) => {
  const diffResult = get(diffResultAtom)
  const resolutions = get(resolutionsAtom)
  const resolvedConfig = get(resolvedConfigAtom)

  const conflictCount = diffResult?.conflicts.length ?? 0
  const resolvedCount = Object.keys(resolutions).length
  const allResolved = diffResult?.conflicts.every(c => resolutions[c.path.join('.')]) ?? true

  return {
    conflictCount,
    resolvedCount,
    allResolved,
    hasValidationError: resolvedConfig?.validationError != null,
    validationError: resolvedConfig?.validationError ?? null,
    isValid: allResolved && resolvedConfig?.validationError == null,
  }
})

// Backward compat alias
export const conflictResolutionsAtom = resolutionsAtom
export const conflictStatusAtom = atom((get) => {
  const status = get(resolutionStatusAtom)
  return {
    total: status.conflictCount,
    resolved: status.resolvedCount,
    allResolved: status.allResolved,
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
  const diffResult = get(diffResultAtom)
  if (!diffResult)
    return
  const resolutions: Record<string, Resolution> = {}
  for (const c of diffResult.conflicts) {
    resolutions[c.path.join('.')] = 'local'
  }
  set(resolutionsAtom, resolutions)
})

export const selectAllRemoteAtom = atom(null, (get, set) => {
  const diffResult = get(diffResultAtom)
  if (!diffResult)
    return
  const resolutions: Record<string, Resolution> = {}
  for (const c of diffResult.conflicts) {
    resolutions[c.path.join('.')] = 'remote'
  }
  set(resolutionsAtom, resolutions)
})
