import { browser } from "#imports"
import { logger } from "@/utils/logger"
import {
  MAX_REMOTE_SITE_RULES_LENGTH,
  REMOTE_SITE_RULES_ENABLED,
  REMOTE_SITE_RULES_URL,
  remoteSiteRulesDocumentSchema,
} from "@/utils/site-rules/remote/document"
import {
  SITE_RULES_PUBLIC_KEYS,
  signedSiteRulesSchema,
  verifySiteRulesSignature,
} from "@/utils/site-rules/remote/signature"
import {
  getStoredRemoteSiteRules,
  setStoredRemoteSiteRules,
} from "@/utils/site-rules/remote/storage"

export const SITE_RULES_UPDATE_ALARM = "site-rules-update"
// Every six hours to start with, while the rules endpoint is new.
export const SITE_RULES_UPDATE_INTERVAL_MINUTES = 6 * 60

// Nothing waits on this request, so a slow link (a common case in mainland
// China) gets plenty of time, and a failure just waits for the next check.
const FETCH_TIMEOUT_MS = 30_000

export type SiteRulesUpdateResult = "updated" | "unchanged" | "failed"

/**
 * Fetches the published rules and stores them once verified, when they are
 * newer than the stored ones. Every failure keeps the current rules.
 *
 * `no-cache` revalidates with the server, so a check that finds nothing new
 * costs a 304 rather than the whole file.
 */
export async function updateRemoteSiteRules(
  publicKeys: Readonly<Record<string, string>> = SITE_RULES_PUBLIC_KEYS,
): Promise<SiteRulesUpdateResult> {
  try {
    const response = await fetch(REMOTE_SITE_RULES_URL, {
      cache: "no-cache",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    const text = await response.text()
    if (text.length > MAX_REMOTE_SITE_RULES_LENGTH) {
      throw new Error(`Response too large: ${text.length} characters`)
    }

    const signed = signedSiteRulesSchema.parse(JSON.parse(text))
    if (!(await verifySiteRulesSignature(signed, publicKeys))) {
      throw new Error(`Signature did not verify (key "${signed.keyId}")`)
    }
    const remote = remoteSiteRulesDocumentSchema.parse(JSON.parse(signed.payload))

    const stored = await getStoredRemoteSiteRules()
    if (stored && remote.revision <= stored.revision) {
      return "unchanged"
    }
    await setStoredRemoteSiteRules({ ...remote, fetchedAt: Date.now() })
    logger.info("[SiteRules] Remote rules updated to revision", remote.revision)
    return "updated"
  } catch (error) {
    logger.warn("[SiteRules] Remote rules update failed; keeping the current rules", error)
    return "failed"
  }
}

export function setUpSiteRulesUpdate() {
  if (!REMOTE_SITE_RULES_ENABLED) {
    return
  }

  // Register synchronously so the alarm can wake the worker during initialization.
  browser.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === SITE_RULES_UPDATE_ALARM) {
      await updateRemoteSiteRules()
    }
  })

  // Only when missing: re-creating it on every worker start would restart the
  // countdown each time. Updates and some browser restarts clear alarms, so the
  // first check after those comes a few minutes in, spread across installs.
  void browser.alarms.get(SITE_RULES_UPDATE_ALARM).then((existingAlarm) => {
    if (!existingAlarm) {
      void browser.alarms.create(SITE_RULES_UPDATE_ALARM, {
        delayInMinutes: 1 + Math.random() * 4,
        periodInMinutes: SITE_RULES_UPDATE_INTERVAL_MINUTES,
      })
    }
  })
}
