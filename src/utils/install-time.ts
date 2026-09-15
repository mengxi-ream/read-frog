import { storage } from "#imports"

const INSTALLED_AT_KEY = "local:installedAt" as const

/**
 * Records when this profile first ran a build that tracks install time.
 *
 * Deliberately written on any `onInstalled` reason rather than only "install": nothing
 * recorded a timestamp before this shipped, so every already-installed user arrives here
 * through "update" and is stamped then. Only ever writes when the key is missing, so
 * later updates leave the original alone.
 *
 * Nothing reads it today — the store review prompt counts active days instead — but an
 * install timestamp cannot be recovered later: skip recording it now and the earliest
 * knowable install date becomes whenever recording finally starts.
 */
export async function ensureInstalledAtRecorded(): Promise<void> {
  const existing = await storage.getItem<number>(INSTALLED_AT_KEY)
  if (typeof existing === "number" && Number.isFinite(existing)) return

  await storage.setItem(INSTALLED_AT_KEY, Date.now())
}
