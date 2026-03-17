import { atom } from "jotai"
import { z } from "zod"
import { ANALYTICS_ENABLED_STORAGE_KEY, DEFAULT_ANALYTICS_ENABLED } from "@/utils/constants/analytics"
import { logger } from "../logger"
import { storageAdapter } from "./storage-adapter"

const analyticsEnabledSchema = z.boolean()

export const baseAnalyticsEnabledAtom = atom<boolean>(DEFAULT_ANALYTICS_ENABLED)

export const analyticsEnabledAtom = atom(
  get => get(baseAnalyticsEnabledAtom),
  async (get, set, nextEnabled: boolean) => {
    const previousEnabled = get(baseAnalyticsEnabledAtom)
    set(baseAnalyticsEnabledAtom, nextEnabled)

    try {
      await storageAdapter.set(
        ANALYTICS_ENABLED_STORAGE_KEY,
        nextEnabled,
        analyticsEnabledSchema,
      )
    }
    catch (error) {
      console.error("Failed to persist analytics preference:", error)
      set(baseAnalyticsEnabledAtom, previousEnabled)
    }
  },
)

baseAnalyticsEnabledAtom.onMount = (setAtom) => {
  void storageAdapter.get(
    ANALYTICS_ENABLED_STORAGE_KEY,
    DEFAULT_ANALYTICS_ENABLED,
    analyticsEnabledSchema,
  ).then(setAtom)

  const unwatch = storageAdapter.watch<boolean>(
    ANALYTICS_ENABLED_STORAGE_KEY,
    setAtom,
  )

  const handleVisibilityChange = () => {
    if (document.visibilityState === "visible") {
      logger.info("baseAnalyticsEnabledAtom onMount handleVisibilityChange when: ", new Date())
      void storageAdapter.get(
        ANALYTICS_ENABLED_STORAGE_KEY,
        DEFAULT_ANALYTICS_ENABLED,
        analyticsEnabledSchema,
      ).then(setAtom)
    }
  }
  document.addEventListener("visibilitychange", handleVisibilityChange)

  return () => {
    unwatch()
    document.removeEventListener("visibilitychange", handleVisibilityChange)
  }
}
