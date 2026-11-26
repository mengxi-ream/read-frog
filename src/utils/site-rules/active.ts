import type { RemoteSiteRulesDocument } from "./remote/document"
import type { SiteRule } from "@/types/config/site-rules"
import { browser } from "#imports"
import { createLogger } from "@/utils/logging/logger"
import { BUILT_IN_SITE_RULES } from "./built-in"
import { REMOTE_SITE_RULES_ENABLED, selectBuiltInSiteRules } from "./remote/document"
import { getStoredRemoteSiteRules, watchStoredRemoteSiteRules } from "./remote/storage"

const log = createLogger("site-rules/active")

// The built-in rules in effect in this context: the bundled ones until the
// stored remote document has loaded, then what `selectBuiltInSiteRules` makes
// of it. Every extension context (the background, each frame's content script,
// the options page) keeps its own copy and follows storage, so an update
// reaches open pages on their next translation.
let remoteRules: RemoteSiteRulesDocument | null = null
let activeRules: SiteRule[] | null = null
let loading: Promise<void> | null = null
const listeners = new Set<() => void>()

/** The same array until the rules change, so it serves as a memo key and a store snapshot. */
export function getActiveBuiltInSiteRules(): SiteRule[] {
  activeRules ??= remoteRules
    ? selectBuiltInSiteRules(
        BUILT_IN_SITE_RULES,
        remoteRules,
        browser.runtime.getManifest().version,
      )
    : BUILT_IN_SITE_RULES
  return activeRules
}

export function setRemoteSiteRulesDocument(remote: RemoteSiteRulesDocument | null): void {
  if (remote === remoteRules) {
    return
  }
  remoteRules = remote
  activeRules = null
  for (const listener of listeners) {
    listener()
  }
}

export function subscribeActiveBuiltInSiteRules(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Reads the stored document and follows its changes. */
export async function loadRemoteSiteRules(): Promise<void> {
  // Watch before reading so an update landing mid-read is not missed, and let
  // that update win over the read, which may predate it.
  let updatedWhileReading = false
  watchStoredRemoteSiteRules((remote) => {
    updatedWhileReading = true
    setRemoteSiteRulesDocument(remote)
  })
  try {
    const stored = await getStoredRemoteSiteRules()
    if (!updatedWhileReading) {
      setRemoteSiteRulesDocument(stored)
    }
  } catch (error) {
    log.warn("Failed to read the stored remote rules", { error })
  }
}

/** Loads once per context. Resolves at once where remote rules are off (development, tests). */
export function ensureRemoteSiteRulesLoaded(): Promise<void> {
  if (!REMOTE_SITE_RULES_ENABLED) {
    return Promise.resolve()
  }
  loading ??= loadRemoteSiteRules()
  return loading
}
