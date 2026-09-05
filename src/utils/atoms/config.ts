import type { Config } from "@/types/config/config"
import { deepmergeCustom } from "deepmerge-ts"
import { dequal } from "dequal"
import { atom } from "jotai"
import { selectAtom } from "jotai/utils"
import { configSchema } from "@/types/config/config"
import { CONFIG_STORAGE_KEY, DEFAULT_CONFIG } from "../constants/config"
import { storageAdapter } from "./storage-adapter"

export const configAtom = atom<Config>(DEFAULT_CONFIG)

export const mergeWithArrayOverwrite = deepmergeCustom({
  // Use the last (source) array
  mergeArrays: (values) => values[values.length - 1],
})

// Updaters deliberately use undefined to clear optional fields. Keep legacy
// object-patch semantics unchanged for the other configuration consumers.
const mergeUpdaterResult = deepmergeCustom({
  mergeArrays: (values) => values[values.length - 1],
  filterValues: false,
})

export type ConfigUpdate = Partial<Config> | ((current: Config) => Partial<Config>)

// Shared by writers in this extension context. Other contexts remain independent.
let writeQueue: Promise<void> = Promise.resolve()
let writeVersion = 0
let pendingWrites = 0
const refreshListeners = new Set<() => void>()

function applyUpdate(current: Config, update: ConfigUpdate): Config {
  return typeof update === "function"
    ? mergeUpdaterResult(current, update(current))
    : mergeWithArrayOverwrite(current, update)
}

export const writeConfigAtom = atom(null, async (get, set, update: ConfigUpdate) => {
  const optimistic = applyUpdate(get(configAtom), update)
  set(configAtom, optimistic)
  const version = ++writeVersion
  pendingWrites++

  const task = writeQueue.then(async () => {
    let stored: Config | undefined
    try {
      stored = await storageAdapter.get(CONFIG_STORAGE_KEY, DEFAULT_CONFIG, configSchema)
      const next = applyUpdate(stored, update)
      await storageAdapter.set(CONFIG_STORAGE_KEY, next, configSchema)
      await storageAdapter.setMeta(CONFIG_STORAGE_KEY, { lastModifiedAt: Date.now() })
      if (version === writeVersion && !dequal(get(configAtom), next)) set(configAtom, next)
    } catch (error) {
      if (version === writeVersion && stored) set(configAtom, stored)
      throw error
    } finally {
      pendingWrites--
      refreshListeners.forEach((refresh) => refresh())
    }
  })
  writeQueue = task.catch(() => {})
  return task
})

// Watch notifications invalidate a read. Their payload may describe an older write,
// and must never replace a newer optimistic update or an already persisted value.
configAtom.onMount = (setAtom) => {
  let active = true
  let requested = false
  let reading = false
  let generation = 0

  async function refresh() {
    if (reading) return
    reading = true
    try {
      while (requested) {
        if (!active) return
        await writeQueue
        if (!active) return
        if (pendingWrites > 0) continue
        requested = false
        const readGeneration = generation
        const readVersion = writeVersion
        const value = await storageAdapter.get(CONFIG_STORAGE_KEY, DEFAULT_CONFIG, configSchema)
        if (!active) return
        if (readGeneration !== generation || readVersion !== writeVersion || pendingWrites > 0) {
          requested = true
          continue
        }
        setAtom((previous) => (dequal(previous, value) ? previous : value))
      }
    } catch {
      // A later notification/visibility change retries reads; retain the current UI.
    } finally {
      reading = false
    }
  }

  const requestRefresh = () => {
    generation++
    requested = true
    void refresh()
  }
  refreshListeners.add(requestRefresh)
  const unwatch = storageAdapter.watch<Config>(CONFIG_STORAGE_KEY, requestRefresh)
  const onVisibilityChange = () => {
    if (document.visibilityState === "visible") requestRefresh()
  }
  document.addEventListener("visibilitychange", onVisibilityChange)
  requestRefresh()

  return () => {
    active = false
    refreshListeners.delete(requestRefresh)
    unwatch()
    document.removeEventListener("visibilitychange", onVisibilityChange)
  }
}

type Keys = keyof Config

export function getConfigFieldAtom<K extends Keys>(key: K) {
  // If you don't mind "re-rendering when other fields are changed"
  // you can directly get(configAtom)[key] instead of using selectAtom.
  const sliceAtom = selectAtom(configAtom, (c) => c[key])

  return atom(
    (get) => get(sliceAtom),
    (_get, set, newVal: Partial<Config[K]> | ((current: Config[K]) => Partial<Config[K]>)) =>
      set(
        writeConfigAtom,
        typeof newVal === "function"
          ? (current) => ({ [key]: newVal(current[key]) })
          : { [key]: newVal },
      ),
  )
}

function buildConfigFieldsAtomMap<C extends Config>(cfg: C) {
  type ValidKey = Extract<keyof C, keyof Config>
  type Map = { [K in ValidKey]: ReturnType<typeof getConfigFieldAtom<K>> }

  const res = {} as Map

  // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- K preserves key-specific atom value inference.
  const add = <K extends ValidKey>(key: K) => {
    res[key] = getConfigFieldAtom(key)
  }

  ;(Object.keys(cfg) as ValidKey[]).forEach(add)
  return res
}

export const configFieldsAtomMap = buildConfigFieldsAtomMap(DEFAULT_CONFIG)
