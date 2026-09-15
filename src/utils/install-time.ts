import { storage } from "#imports"

export const INSTALLED_AT_STORAGE_KEY = "installedAt"

const INSTALLED_AT_KEY = `local:${INSTALLED_AT_STORAGE_KEY}` as const

/**
 * Records when this profile first ran a build that tracks install time.
 *
 * Deliberately written on any `onInstalled` reason rather than only "install": nothing
 * recorded a timestamp before this shipped, so every already-installed user arrives here
 * through "update" and is stamped then.
 *
 * Nothing gates on this today — the store review prompt counts active days instead — but
 * it is kept because an install timestamp is the kind of data that cannot be recovered
 * later: skip recording it now and the earliest knowable install date becomes whenever
 * recording finally starts.
 *
 * Only ever writes when the key is missing, so later updates leave the original alone.
 */
export async function ensureInstalledAtRecorded(now: number = Date.now()): Promise<number> {
  const existing = await getInstalledAt()
  if (existing !== null) return existing

  await storage.setItem(INSTALLED_AT_KEY, now)
  return now
}

export async function getInstalledAt(): Promise<number | null> {
  const value = await storage.getItem<number>(INSTALLED_AT_KEY)
  return typeof value === "number" && Number.isFinite(value) ? value : null
}
