import type { Config } from '@/types/config/config'
import { deepmergeCustom } from 'deepmerge-ts'
import { atom } from 'jotai'
import { selectAtom } from 'jotai/utils'
import { configSchema } from '@/types/config/config'
import { CONFIG_STORAGE_KEY, DEFAULT_CONFIG } from '../constants/config'
import { logger } from '../logger'
import { storageAdapter } from './storage-adapter'

export const configAtom = atom<Config>(DEFAULT_CONFIG)

export const mergeWithArrayOverwrite = deepmergeCustom({
  // Use the last (source) array
  mergeArrays: values => values[values.length - 1],
})

/**
 * Promise-chain queue for serializing storage writes.
 *
 * Each write chains onto the previous via `.then()`, ensuring sequential execution:
 *   Promise.resolve() → task1 → task2 → task3 → ...
 *
 * This prevents race conditions when multiple writes happen in quick succession.
 * Even if a write fails, the queue continues (see `.catch(() => {})` below).
 */
let writeQueue: Promise<void> = Promise.resolve()

/**
 * Global counter to detect stale writes.
 *
 * Each write captures its version at invocation time. After async storage completes,
 * we compare captured vs current version to determine if this is still the latest write.
 * This prevents older writes from overwriting the optimistic UI state.
 */
let writeVersion = 0

export const writeConfigAtom = atom(
  null,
  async (get, set, patch: Partial<Config>) => {
    // ─────────────────────────────────────────────────────────────────────────
    // STEP 1: Optimistic update (immediate UI feedback)
    // ─────────────────────────────────────────────────────────────────────────
    const localPrev = get(configAtom)
    const optimisticNext = mergeWithArrayOverwrite(localPrev, patch)
    set(configAtom, optimisticNext)

    // Capture version for this write (used for stale-write detection later)
    const currentWriteVersion = ++writeVersion

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 2: Queue the actual storage write
    // ─────────────────────────────────────────────────────────────────────────
    // Chain onto writeQueue so writes execute in order.
    // Note: `.then(callback)` schedules callback to microtask queue (async),
    // but `writeQueue = task` assignment happens synchronously.
    const task = writeQueue.then(async () => {
      // Always read fresh from storage to capture any writes that completed before us.
      // This ensures we don't lose concurrent field updates:
      //   write({x:1}) then write({y:2}) → storage ends up with {x:1, y:2}
      const configInStorage = await storageAdapter.get<Config>(CONFIG_STORAGE_KEY, DEFAULT_CONFIG, configSchema)
      const nextToPersist = mergeWithArrayOverwrite(configInStorage, patch)

      try {
        // Storage write always executes (not affected by version check)
        await storageAdapter.set(CONFIG_STORAGE_KEY, nextToPersist, configSchema)
        await storageAdapter.setMeta(CONFIG_STORAGE_KEY, { lastModifiedAt: Date.now() })

        // ───────────────────────────────────────────────────────────────────
        // STEP 3: Reconcile atom with persisted value (stale-write check)
        // ───────────────────────────────────────────────────────────────────
        // Only update atom if no newer writes happened since we started.
        // If a newer write exists, its optimistic update already set the correct UI state,
        // so we skip to avoid "flashing back" to this older value.
        if (currentWriteVersion === writeVersion) {
          set(configAtom, nextToPersist)
        }
      }
      catch (error) {
        console.error('Failed to set config to storage:', nextToPersist, error)

        // Roll back to storage value on error, but only if we're still the latest write.
        if (currentWriteVersion === writeVersion) {
          set(configAtom, configInStorage)
        }

        throw error
      }
    })

    // Update queue head. Use `.catch(() => {})` to ensure queue continues even if this write fails.
    writeQueue = task.catch(() => {})

    return task
  },
)

/**
 * Initialize atom state from storage and set up cross-context sync.
 *
 * This handles three sync scenarios:
 * 1. Initial load: Read from storage when atom first mounts
 * 2. Cross-context updates: Watch for changes from other extension contexts (popup, options, etc.)
 * 3. Tab reactivation: Reload when tab becomes visible (inactive tabs may miss watch events)
 */
configAtom.onMount = (setAtom: (newValue: Config) => void) => {
  // Flag to avoid race condition: if watch fires before initial get() resolves,
  // don't overwrite the fresher watch value with the stale get() result.
  let didReceiveStorageUpdate = false

  // Initial load from storage
  void storageAdapter.get<Config>(CONFIG_STORAGE_KEY, DEFAULT_CONFIG, configSchema).then((value) => {
    if (!didReceiveStorageUpdate) {
      setAtom(value)
    }
  })

  // Watch for changes from other extension contexts (popup, options page, other tabs)
  const unwatch = storageAdapter.watch<Config>(CONFIG_STORAGE_KEY, (value) => {
    didReceiveStorageUpdate = true
    setAtom(value)
  })

  // Handle tab reactivation - inactive tabs may miss storage watch events,
  // so we reload from storage when the tab becomes visible again.
  // See: https://github.com/mengxi-ream/read-frog/issues/435
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      logger.info('configAtom onMount handleVisibilityChange when: ', new Date())
      void storageAdapter.get<Config>(CONFIG_STORAGE_KEY, DEFAULT_CONFIG, configSchema).then(setAtom)
    }
  }
  document.addEventListener('visibilitychange', handleVisibilityChange)

  return () => {
    unwatch()
    document.removeEventListener('visibilitychange', handleVisibilityChange)
  }
}

// export const configFieldAtom = <K extends Keys>(key: K) => {
//   const readAtom = selectAtom(configAtom, (c) => c[key]); // 现在是同步
//   const writeAtom = atom(null, (_get, set, val: Config[K]) =>
//     set(writeConfigAtom, { [key]: val })
//   );
//   return [readAtom, writeAtom] as const;
// };

type Keys = keyof Config

export function getConfigFieldAtom<K extends Keys>(key: K) {
  // If you don't mind "re-rendering when other fields are changed"
  // you can directly get(configAtom)[key] instead of using selectAtom.
  const sliceAtom = selectAtom(configAtom, c => c[key])

  return atom(
    get => get(sliceAtom),
    (_get, set, newVal: Partial<Config[K]>) =>
      set(writeConfigAtom, { [key]: newVal }),
  )
}

function buildConfigFieldsAtomMap<C extends Config>(cfg: C) {
  type ValidKey = Extract<keyof C, keyof Config>
  type Map = { [K in ValidKey]: ReturnType<typeof getConfigFieldAtom<K>> }

  const res = {} as Map

  const add = <K extends ValidKey>(key: K) => {
    res[key] = getConfigFieldAtom(key)
  };

  (Object.keys(cfg) as ValidKey[]).forEach(add)
  return res
}

export const configFieldsAtomMap = buildConfigFieldsAtomMap(DEFAULT_CONFIG)
