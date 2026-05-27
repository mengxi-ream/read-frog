import type { LastSyncedConfigMeta } from "@/types/config/meta"
import { storage } from "#imports"
import { atom } from "jotai"
import { LAST_SYNCED_CONFIG_STORAGE_KEY } from "../constants/config"
import { logger } from "../logger"

// internal atom for storing last sync time (from lastSyncedConfig meta)
const _lastSyncTimeBaseAtom = atom<number | null>(null)

_lastSyncTimeBaseAtom.onMount = (setAtom: (newValue: number | null) => void) => {
  void storage.getMeta<LastSyncedConfigMeta>(`local:${LAST_SYNCED_CONFIG_STORAGE_KEY}`).then(meta => setAtom(meta?.lastSyncedAt ?? null)).catch((error) => {
    logger.error("lastSyncTimeAtom initial storage load failed", error)
  })

  // Add $ to the key to get the meta key for LAST_SYNCED_CONFIG_STORAGE_KEY
  const metaKey = `local:${LAST_SYNCED_CONFIG_STORAGE_KEY}$`

  let unwatch: () => void
  try {
    unwatch = storage.watch<LastSyncedConfigMeta>(metaKey, (newMeta, _) => {
      const meta = newMeta
      setAtom(meta?.lastSyncedAt ?? null)
    })
  }
  catch (error) {
    logger.error("lastSyncTimeAtom storage watch setup failed", error)
    unwatch = () => {}
  }

  return unwatch
}

// export read-only derived atom
export const lastSyncTimeAtom = atom(get => get(_lastSyncTimeBaseAtom))
