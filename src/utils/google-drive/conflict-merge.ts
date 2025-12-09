import type { ZodError } from 'zod'
import type { Config } from '@/types/config/config'
import { dequal } from 'dequal'
import { configSchema } from '@/types/config/config'
import { logger } from '../logger'

// Base shape + type discriminator
export interface FieldChange {
  type: 'conflict' | 'difference'
  path: string[] // ['language', 'targetCode']
  baseValue: unknown
  localValue: unknown
  remoteValue: unknown
}

// Type aliases for narrowed types
export type FieldConflict = FieldChange & { type: 'conflict' }
export type FieldDifference = FieldChange & { type: 'difference' }

export interface ChangeDiffResult {
  merged: Config
  conflicts: FieldConflict[]
  differences: FieldDifference[]
  validationError: ZodError | null
}

/**
 * Recursively detect changes between base, local, and remote configs
 * Returns merged config and list of conflicts/differences
 */
export function detectChanges(
  base: Config,
  local: Config,
  remote: Config,
): ChangeDiffResult {
  const conflicts: FieldConflict[] = []
  const differences: FieldDifference[] = []

  const isAtomicValue = (val: unknown) =>
    val == null || typeof val !== 'object' || Array.isArray(val)

  function traverse(
    basePath: string[],
    baseVal: any,
    localVal: any,
    remoteVal: any,
  ) {
    // Handle atomic values (primitives, nulls, arrays)
    if (isAtomicValue(baseVal) || isAtomicValue(localVal) || isAtomicValue(remoteVal)) {
      const localChanged = !dequal(localVal, baseVal)
      const remoteChanged = !dequal(remoteVal, baseVal)

      if (localChanged && remoteChanged) {
        if (dequal(localVal, remoteVal)) {
          return localVal
        }
        else {
          conflicts.push({
            type: 'conflict',
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
        // Only local changed - track as difference
        differences.push({
          type: 'difference',
          path: basePath,
          baseValue: baseVal,
          localValue: localVal,
          remoteValue: remoteVal,
        })
        return localVal
      }
      else if (remoteChanged) {
        // Only remote changed - track as difference
        differences.push({
          type: 'difference',
          path: basePath,
          baseValue: baseVal,
          localValue: localVal,
          remoteValue: remoteVal,
        })
        return remoteVal
      }
      else {
        // No change
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
    logger.error('Merged config is invalid', validatedMergedResult.error)
    // Return with validation error instead of throwing
    return {
      merged: mergedResult as Config,
      conflicts,
      differences,
      validationError: validatedMergedResult.error,
    }
  }

  return {
    merged: validatedMergedResult.data,
    conflicts,
    differences,
    validationError: null,
  }
}

/**
 * Apply a resolution to a field change (conflict or difference)
 */
function applyFieldResolution(
  result: any,
  change: FieldChange,
  resolution: 'local' | 'remote',
): void {
  // Navigate to the parent object
  let current: any = result
  for (let i = 0; i < change.path.length - 1; i++) {
    current = current[change.path[i]]
  }

  // Set the resolved value
  const lastKey = change.path[change.path.length - 1]
  current[lastKey] = resolution === 'local' ? change.localValue : change.remoteValue
}

export interface ApplyResolutionsResult {
  config: Config | null
  validationError: ZodError | null
}

/**
 * Apply user resolutions to the merged config
 * Handles both conflicts and differences
 */
export function applyResolutions(
  diffResult: ChangeDiffResult,
  resolutions: Record<string, 'local' | 'remote'>,
): ApplyResolutionsResult {
  // Deep clone the merged result to avoid mutating original
  const result = JSON.parse(JSON.stringify(diffResult.merged))

  // Apply resolutions for conflicts
  for (const conflict of diffResult.conflicts) {
    const pathKey = conflict.path.join('.')
    const resolution = resolutions[pathKey]

    if (!resolution) {
      logger.warn('Unresolved conflict', { path: pathKey })
      continue
    }

    applyFieldResolution(result, conflict, resolution)
  }

  // Apply resolutions for differences (if user chose to override)
  for (const difference of diffResult.differences) {
    const pathKey = difference.path.join('.')
    const resolution = resolutions[pathKey]

    if (!resolution) {
      // No override for difference - keep merged value
      continue
    }

    applyFieldResolution(result, difference, resolution)
  }

  const validatedResult = configSchema.safeParse(result)
  if (!validatedResult.success) {
    logger.error('Resolved config is invalid', validatedResult.error)
    return {
      config: null,
      validationError: validatedResult.error,
    }
  }

  return {
    config: validatedResult.data,
    validationError: null,
  }
}
