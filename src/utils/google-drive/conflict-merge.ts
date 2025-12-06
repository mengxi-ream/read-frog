import type { Config } from '@/types/config/config'
import { dequal } from 'dequal'
import { configSchema } from '@/types/config/config'
import { logger } from '../logger'

export interface FieldConflict {
  path: string[] // ['language', 'targetCode']
  baseValue: unknown
  localValue: unknown
  remoteValue: unknown
}

export interface ConflictDiffResult {
  merged: Config
  conflicts: FieldConflict[]
}

/**
 * Recursively detect conflicts between base, local, and remote configs
 * Returns merged config and list of conflicts
 */
export function detectConflicts(
  base: Config,
  local: Config,
  remote: Config,
): ConflictDiffResult {
  const conflicts: FieldConflict[] = []

  function traverse(
    basePath: string[],
    baseVal: any,
    localVal: any,
    remoteVal: any,
  ) {
    // Handle primitive values or null
    if (
      baseVal == null
      || localVal == null
      || remoteVal == null
      || typeof baseVal !== 'object'
      || typeof localVal !== 'object'
      || typeof remoteVal !== 'object'
    ) {
      const localChanged = !dequal(localVal, baseVal)
      const remoteChanged = !dequal(remoteVal, baseVal)

      if (localChanged && remoteChanged) {
        if (dequal(localVal, remoteVal)) {
          return localVal
        }
        else {
          conflicts.push({
            path: basePath,
            baseValue: baseVal,
            localValue: localVal,
            remoteValue: remoteVal,
          })
          // Default to local for now (will be resolved by user)
          return localVal
        }
      }
      else if (localChanged) {
        // Only local changed
        return localVal
      }
      else if (remoteChanged) {
        // Only remote changed
        return remoteVal
      }
      else {
        // No change
        return baseVal
      }
    }

    // Handle arrays
    if (Array.isArray(baseVal)) {
      const localChanged = !dequal(localVal, baseVal)
      const remoteChanged = !dequal(remoteVal, baseVal)

      if (localChanged && remoteChanged) {
        if (dequal(localVal, remoteVal)) {
          return localVal
        }
        else {
          conflicts.push({
            path: basePath,
            baseValue: baseVal,
            localValue: localVal,
            remoteValue: remoteVal,
          })
          return localVal
        }
      }
      else if (localChanged) {
        return localVal
      }
      else if (remoteChanged) {
        return remoteVal
      }
      else {
        return baseVal
      }
    }

    // Handle objects - recurse into properties
    const result: any = {}
    const allKeys = new Set([
      ...Object.keys(baseVal),
      ...Object.keys(localVal),
      ...Object.keys(remoteVal),
    ])

    for (const key of allKeys) {
      result[key] = traverse(
        [...basePath, key],
        baseVal[key],
        localVal[key],
        remoteVal[key],
      )
    }

    return result
  }

  const mergedResult = traverse([], base, local, remote)

  const validatedMergedResult = configSchema.safeParse(mergedResult)
  if (!validatedMergedResult.success) {
    logger.error('Merged config is invalid, cannot detect conflicts')
    throw new Error('Merged config is invalid for conflict detection')
  }

  return {
    merged: validatedMergedResult.data,
    conflicts,
  }
}

/**
 * Apply user resolutions to the merged config
 */
export function applyResolutions(
  diffResult: ConflictDiffResult,
  resolutions: Record<string, 'local' | 'remote'>,
): Config {
  const parsedResult = configSchema.safeParse(diffResult.merged)
  if (!parsedResult.success) {
    logger.error('Merged config is invalid, cannot apply resolutions')
    throw new Error('Merged config is invalid for conflict resolution')
  }
  const result = parsedResult.data

  for (const conflict of diffResult.conflicts) {
    const pathKey = conflict.path.join('.')
    const resolution = resolutions[pathKey]

    if (!resolution) {
      logger.warn('Unresolved conflict', { path: pathKey })
      continue
    }

    // Navigate to the parent object
    let current: any = result
    for (let i = 0; i < conflict.path.length - 1; i++) {
      current = current[conflict.path[i]]
    }

    // Set the resolved value
    const lastKey = conflict.path[conflict.path.length - 1]
    current[lastKey] = resolution === 'local' ? conflict.localValue : conflict.remoteValue
  }

  const validatedResult = configSchema.safeParse(result)
  if (!validatedResult.success) {
    logger.error('Validated merged config is invalid, cannot apply resolutions')
    throw new Error('Validated merged config is invalid for conflict resolution')
  }

  return validatedResult.data
}
