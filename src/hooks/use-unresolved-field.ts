import type { FieldChange } from '@/utils/google-drive/conflict-merge'
import { useAtomValue, useSetAtom } from 'jotai'
import { useMemo } from 'react'
import {
  diffResultAtom,
  resetResolutionAtom,
  resolutionsAtom,
  selectResolutionAtom,
} from '@/utils/atoms/google-drive-sync'

export type FieldChangeType = 'conflict' | 'difference'

export interface UseFieldChangeResult {
  change: FieldChange | undefined
  resolution: 'local' | 'remote' | undefined
  selectLocal: () => void
  selectRemote: () => void
  reset: () => void
}

export function useFieldChange(pathKey: string, type: FieldChangeType): UseFieldChangeResult {
  const diffResult = useAtomValue(diffResultAtom)
  const resolutions = useAtomValue(resolutionsAtom)
  const selectResolution = useSetAtom(selectResolutionAtom)
  const resetResolution = useSetAtom(resetResolutionAtom)

  return useMemo(() => {
    const changes = type === 'conflict' ? diffResult?.conflicts : diffResult?.differences
    const change = changes?.find(c => c.path.join('.') === pathKey)

    return {
      change,
      resolution: resolutions[pathKey],
      selectLocal: () => selectResolution({ pathKey, resolution: 'local' }),
      selectRemote: () => selectResolution({ pathKey, resolution: 'remote' }),
      reset: () => resetResolution(pathKey),
    }
  }, [diffResult, resolutions, pathKey, type, selectResolution, resetResolution])
}

export function useUnresolvedField(pathKey: string) {
  const result = useFieldChange(pathKey, 'conflict')
  return {
    unresolved: result.change,
    resolution: result.resolution,
    selectLocal: result.selectLocal,
    selectRemote: result.selectRemote,
    reset: result.reset,
  }
}

export function useDifferenceField(pathKey: string) {
  const result = useFieldChange(pathKey, 'difference')
  return {
    difference: result.change,
    resolution: result.resolution,
    selectLocal: result.selectLocal,
    selectRemote: result.selectRemote,
    reset: result.reset,
  }
}
