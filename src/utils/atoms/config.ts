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

let writeQueue: Promise<void> = Promise.resolve()
let writeVersion = 0

export const writeConfigAtom = atom(
  null,
  async (get, set, patch: Partial<Config>) => {
    const localPrev = get(configAtom)
    const optimisticNext = mergeWithArrayOverwrite(localPrev, patch)
    set(configAtom, optimisticNext)

    const currentWriteVersion = ++writeVersion

    const task = writeQueue.then(async () => {
      const configInStorage = await storageAdapter.get<Config>(CONFIG_STORAGE_KEY, DEFAULT_CONFIG, configSchema)
      const nextToPersist = mergeWithArrayOverwrite(configInStorage, patch)

      try {
        await storageAdapter.set(CONFIG_STORAGE_KEY, nextToPersist, configSchema)
        await storageAdapter.setMeta(CONFIG_STORAGE_KEY, { lastModifiedAt: Date.now() })

        // Reconcile atom state with the persisted value (storage is the source of truth),
        // but only if no newer writes happened in this JS context.
        if (currentWriteVersion === writeVersion) {
          set(configAtom, nextToPersist)
        }
      }
      catch (error) {
        console.error('Failed to set config to storage:', nextToPersist, error)

        // Roll back to the latest value from storage, but don't clobber newer writes.
        if (currentWriteVersion === writeVersion) {
          set(configAtom, configInStorage)
        }

        throw error
      }
    })

    // Ensure the queue continues even if a write fails.
    writeQueue = task.catch(() => {})

    return task
  },
)

configAtom.onMount = (setAtom: (newValue: Config) => void) => {
  let didReceiveStorageUpdate = false

  void storageAdapter.get<Config>(CONFIG_STORAGE_KEY, DEFAULT_CONFIG, configSchema).then((value) => {
    if (!didReceiveStorageUpdate) {
      setAtom(value)
    }
  })

  const unwatch = storageAdapter.watch<Config>(CONFIG_STORAGE_KEY, (value) => {
    didReceiveStorageUpdate = true
    setAtom(value)
  })

  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      // If the tab becomes visible again, reload the config from storage
      // to make sure the config is the newest
      // This is to fix the issue that when a tab becomes inactive, it won't watch the config change
      // and when it becomes active, the config is not the newest
      // Github issue: https://github.com/mengxi-ream/read-frog/issues/435
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
