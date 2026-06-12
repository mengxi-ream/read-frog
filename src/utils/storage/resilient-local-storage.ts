import { storage } from "#imports"
import { logger } from "@/utils/logger"

export type LocalStorageKey = `local:${string}`

type SessionStorageKey = `session:${string}`
type StorageWatcher<T> = (newValue: T | null) => void
interface RemoveItemOptions {
  removeMeta?: boolean
}
interface LocalStorageItemToRemove {
  key: LocalStorageKey
  options?: RemoveItemOptions
}

const LOCAL_PREFIX = "local:"
const memoryItems = new Map<LocalStorageKey, unknown>()
const memoryMetas = new Map<LocalStorageKey, Record<string, unknown>>()
const volatileItemKeys = new Set<LocalStorageKey>()
const volatileMetaKeys = new Set<LocalStorageKey>()
const fallbackWatchers = new Map<LocalStorageKey, Set<StorageWatcher<unknown>>>()

function toSessionKey(key: LocalStorageKey): SessionStorageKey {
  return `session:${key.slice(LOCAL_PREFIX.length)}`
}

function toErrorFields(error: unknown): { name: string, message: string } {
  if (error instanceof Error) {
    return { name: error.name, message: error.message }
  }

  if (typeof error === "object" && error) {
    const maybeError = error as { name?: unknown, message?: unknown }
    return {
      name: typeof maybeError.name === "string" ? maybeError.name : "",
      message: typeof maybeError.message === "string" ? maybeError.message : String(error),
    }
  }

  return { name: "", message: String(error) }
}

export function isStorageMutationUnavailableError(error: unknown): boolean {
  const { name, message } = toErrorFields(error)
  const normalized = `${name} ${message}`.toLowerCase()

  return normalized.includes("invalidstateerror")
    && (
      normalized.includes("did not allow mutations")
      || (normalized.includes("mutation") && normalized.includes("database"))
    )
}

function warnLocalStorageUnavailable(operation: string, key: LocalStorageKey, error: unknown) {
  logger.warn(`Local storage ${operation} failed; using volatile fallback for ${key}`, error)
}

function warnSessionFallbackUnavailable(operation: string, key: LocalStorageKey, error: unknown) {
  logger.warn(`Session storage fallback ${operation} failed; using memory fallback for ${key}`, error)
}

function notifyFallbackWatchers<T>(key: LocalStorageKey, value: T | null) {
  const watchers = fallbackWatchers.get(key)
  if (!watchers) {
    return
  }

  for (const watcher of watchers) {
    watcher(value)
  }
}

async function getFallbackItem<T>(key: LocalStorageKey): Promise<T | null> {
  if (memoryItems.has(key)) {
    return memoryItems.get(key) as T
  }

  try {
    return await storage.getItem<T>(toSessionKey(key)) ?? null
  }
  catch (error) {
    warnSessionFallbackUnavailable("read", key, error)
    return memoryItems.has(key) ? memoryItems.get(key) as T : null
  }
}

async function getFallbackMeta<T extends Record<string, unknown>>(key: LocalStorageKey): Promise<T | null> {
  const memoryMeta = memoryMetas.get(key)

  try {
    const sessionMeta = await storage.getMeta<T>(toSessionKey(key))
    if (!memoryMeta) {
      return sessionMeta ?? null
    }
    return { ...(sessionMeta ?? {}), ...memoryMeta } as T
  }
  catch (error) {
    warnSessionFallbackUnavailable("metadata read", key, error)
    return memoryMeta ? memoryMeta as T : null
  }
}

async function setFallbackItem<T>(key: LocalStorageKey, value: T): Promise<void> {
  memoryItems.set(key, value)

  try {
    await storage.setItem<T>(toSessionKey(key), value)
  }
  catch (error) {
    warnSessionFallbackUnavailable("write", key, error)
  }
}

async function setFallbackMeta<T extends Record<string, unknown>>(key: LocalStorageKey, meta: T): Promise<void> {
  memoryMetas.set(key, { ...(memoryMetas.get(key) ?? {}), ...meta })

  try {
    await storage.setMeta<T>(toSessionKey(key), meta)
  }
  catch (error) {
    warnSessionFallbackUnavailable("metadata write", key, error)
  }
}

async function removeFallbackItem(key: LocalStorageKey, options?: RemoveItemOptions): Promise<void> {
  memoryItems.delete(key)
  if (options?.removeMeta) {
    memoryMetas.delete(key)
  }

  try {
    await storage.removeItem(toSessionKey(key), options)
  }
  catch (error) {
    warnSessionFallbackUnavailable("remove", key, error)
  }
}

export async function getResilientLocalItem<T>(key: LocalStorageKey): Promise<T | null> {
  if (volatileItemKeys.has(key)) {
    return await getFallbackItem<T>(key)
  }

  try {
    const value = await storage.getItem<T>(key)
    return value ?? null
  }
  catch (error) {
    if (!isStorageMutationUnavailableError(error)) {
      throw error
    }

    volatileItemKeys.add(key)
    warnLocalStorageUnavailable("read", key, error)
    return await getFallbackItem<T>(key)
  }
}

export async function setResilientLocalItem<T>(key: LocalStorageKey, value: T): Promise<void> {
  try {
    await storage.setItem<T>(key, value)
    volatileItemKeys.delete(key)
    memoryItems.set(key, value)
  }
  catch (error) {
    if (!isStorageMutationUnavailableError(error)) {
      throw error
    }

    volatileItemKeys.add(key)
    warnLocalStorageUnavailable("write", key, error)
    await setFallbackItem(key, value)
    notifyFallbackWatchers(key, value)
  }
}

export async function removeResilientLocalItem(key: LocalStorageKey, options?: RemoveItemOptions): Promise<void> {
  try {
    await storage.removeItem(key, options)
    volatileItemKeys.delete(key)
    if (options?.removeMeta) {
      volatileMetaKeys.delete(key)
    }
  }
  catch (error) {
    if (!isStorageMutationUnavailableError(error)) {
      throw error
    }

    volatileItemKeys.add(key)
    if (options?.removeMeta) {
      volatileMetaKeys.add(key)
    }
    warnLocalStorageUnavailable("remove", key, error)
  }

  await removeFallbackItem(key, options)
  notifyFallbackWatchers(key, null)
  if (options?.removeMeta) {
    notifyFallbackWatchers(`${key}$`, null)
  }
}

export async function removeResilientLocalItems(items: LocalStorageItemToRemove[]): Promise<void> {
  await Promise.all(items.map(item => removeResilientLocalItem(item.key, item.options)))
}

export async function getResilientLocalMeta<T extends Record<string, unknown>>(key: LocalStorageKey): Promise<T | null> {
  if (volatileMetaKeys.has(key)) {
    return await getFallbackMeta<T>(key)
  }

  try {
    const meta = await storage.getMeta<T>(key)
    return meta ?? null
  }
  catch (error) {
    if (!isStorageMutationUnavailableError(error)) {
      throw error
    }

    volatileMetaKeys.add(key)
    warnLocalStorageUnavailable("metadata read", key, error)
    return await getFallbackMeta<T>(key)
  }
}

export async function setResilientLocalMeta<T extends Record<string, unknown>>(key: LocalStorageKey, meta: T): Promise<void> {
  try {
    await storage.setMeta<T>(key, meta)
    volatileMetaKeys.delete(key)
    memoryMetas.set(key, { ...(memoryMetas.get(key) ?? {}), ...meta })
  }
  catch (error) {
    if (!isStorageMutationUnavailableError(error)) {
      throw error
    }

    volatileMetaKeys.add(key)
    warnLocalStorageUnavailable("metadata write", key, error)
    await setFallbackMeta(key, meta)
    notifyFallbackWatchers(`${key}$`, meta)
  }
}

export function watchResilientLocalItem<T>(
  key: LocalStorageKey,
  callback: StorageWatcher<T>,
): () => void {
  let unwatchLocal: (() => void) | undefined

  try {
    unwatchLocal = storage.watch<T>(key, callback)
  }
  catch (error) {
    if (!isStorageMutationUnavailableError(error)) {
      throw error
    }

    warnLocalStorageUnavailable("watch", key, error)
  }

  const watchers = fallbackWatchers.get(key) ?? new Set<StorageWatcher<unknown>>()
  watchers.add(callback as StorageWatcher<unknown>)
  fallbackWatchers.set(key, watchers)

  return () => {
    unwatchLocal?.()
    watchers.delete(callback as StorageWatcher<unknown>)
    if (watchers.size === 0) {
      fallbackWatchers.delete(key)
    }
  }
}
