import type { Config } from '@/types/config/config'
import { deepmergeCustom } from 'deepmerge-ts'
import { atom } from 'jotai'
import { selectAtom } from 'jotai/utils'
import { CONFIG_STORAGE_KEY, DEFAULT_CONFIG } from '../constants/config'
import { storageAdapter } from './storage-adapter'

export const configAtom = atom<Config>(DEFAULT_CONFIG)

export const mergeWithArrayOverwrite = deepmergeCustom({
  // Use the last (source) array
  mergeArrays: values => values[values.length - 1],
})

let configPromise: Promise<Config> | null = null

function ensureConfigLoaded(): Promise<Config> {
  if (!configPromise) {
    configPromise = storageAdapter.get<Config>(CONFIG_STORAGE_KEY, DEFAULT_CONFIG)
  }
  return configPromise
}

export const writeConfigAtom = atom(
  null,
  async (get, set, patch: Partial<Config>) => {
    // Ensure config is loaded from storage before any writes
    const savedConfig = await ensureConfigLoaded()

    // If configAtom still has default value, update it with saved config
    if (get(configAtom) === DEFAULT_CONFIG) {
      set(configAtom, savedConfig)
    }

    const next = mergeWithArrayOverwrite(get(configAtom), patch)
    set(configAtom, next)
    await storageAdapter.set(CONFIG_STORAGE_KEY, next)
  },
)

configAtom.onMount = (setAtom: (newValue: Config) => void) => {
  // Load config on mount
  ensureConfigLoaded().then(setAtom)

  // Watch for external changes
  const unwatch = storageAdapter.watch<Config>(CONFIG_STORAGE_KEY, setAtom)

  return () => {
    unwatch()
    configPromise = null // Reset on unmount for hot reload
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
  // 如果不介意"改别的字段也重渲"，可以直接 get(configAtom)[key] 而不使用 selectAtom。
  const sliceAtom = selectAtom(configAtom, c => c[key])

  return atom(
    get => get(sliceAtom),
    (_get, set, newVal: Partial<Config[K]>) =>
      set(writeConfigAtom, { [key]: newVal }),
  )
}

function buildConfigFields<C extends Config>(cfg: C) {
  type ValidKey = Extract<keyof C, keyof Config>
  type Map = { [K in ValidKey]: ReturnType<typeof getConfigFieldAtom<K>> }

  const res = {} as Map

  const add = <K extends ValidKey>(key: K) => {
    res[key] = getConfigFieldAtom(key)
  };

  (Object.keys(cfg) as ValidKey[]).forEach(add)
  return res
}

export const configFields = buildConfigFields(DEFAULT_CONFIG)
