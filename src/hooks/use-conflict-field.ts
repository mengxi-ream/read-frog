import { useAtomValue, useSetAtom } from 'jotai'
import { useMemo } from 'react'
import {
  conflictResolutionsAtom,
  diffResultAtom,
  resetResolutionAtom,
  selectResolutionAtom,
} from '@/utils/atoms/google-drive-sync'

export function useConflictField(pathKey: string) {
  const diffResult = useAtomValue(diffResultAtom)
  const resolutions = useAtomValue(conflictResolutionsAtom)
  const selectResolution = useSetAtom(selectResolutionAtom)
  const resetResolution = useSetAtom(resetResolutionAtom)

  return useMemo(() => ({
    conflict: diffResult?.conflicts.find(c => c.path.join('.') === pathKey),
    resolution: resolutions[pathKey],
    selectLocal: () => selectResolution({ pathKey, resolution: 'local' }),
    selectRemote: () => selectResolution({ pathKey, resolution: 'remote' }),
    reset: () => resetResolution(pathKey),
  }), [diffResult, resolutions, pathKey, selectResolution, resetResolution])
}
