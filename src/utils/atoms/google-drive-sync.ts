import type { Config } from '@/types/config/config'
import type { ConflictDiffResult } from '@/utils/google-drive/conflict-merge'
import { atom } from 'jotai'
import { detectConflicts } from '@/utils/google-drive/conflict-merge'

export interface ConflictData {
  base: Config
  local: Config
  remote: Config
}

type Resolution = 'local' | 'remote'

export const conflictDataAtom = atom<ConflictData | null>(null)
export const conflictResolutionsAtom = atom<Record<string, Resolution>>({})

export const diffResultAtom = atom<ConflictDiffResult | null>((get) => {
  const conflictData = get(conflictDataAtom)
  if (!conflictData)
    return null
  return detectConflicts(conflictData.base, conflictData.local, conflictData.remote)
})

export const conflictStatusAtom = atom((get) => {
  const diffResult = get(diffResultAtom)
  const resolutions = get(conflictResolutionsAtom)
  const total = diffResult?.conflicts.length ?? 0
  const resolved = Object.keys(resolutions).length
  return {
    total,
    resolved,
    allResolved: total === 0 || resolved === total,
  }
})

export const selectResolutionAtom = atom(
  null,
  (_get, set, { pathKey, resolution }: { pathKey: string, resolution: Resolution }) => {
    set(conflictResolutionsAtom, prev => ({ ...prev, [pathKey]: resolution }))
  },
)

export const resetResolutionAtom = atom(null, (_get, set, pathKey: string) => {
  set(conflictResolutionsAtom, (prev) => {
    const next = { ...prev }
    delete next[pathKey]
    return next
  })
})

export const selectAllLocalAtom = atom(null, (get, set) => {
  const diffResult = get(diffResultAtom)
  if (!diffResult)
    return
  const resolutions = Object.fromEntries(
    diffResult.conflicts.map(c => [c.path.join('.'), 'local' as const]),
  )
  set(conflictResolutionsAtom, resolutions)
})

export const selectAllRemoteAtom = atom(null, (get, set) => {
  const diffResult = get(diffResultAtom)
  if (!diffResult)
    return
  const resolutions = Object.fromEntries(
    diffResult.conflicts.map(c => [c.path.join('.'), 'remote' as const]),
  )
  set(conflictResolutionsAtom, resolutions)
})
