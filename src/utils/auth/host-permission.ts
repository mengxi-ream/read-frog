import { browser } from "#imports"
import { env } from "@/env"
import { logger } from "@/utils/logger"

function toOriginPattern(url: string): string {
  return `${new URL(url).origin}/*`
}

/**
 * The origins account features need. `WXT_API_URL` is the load-bearing one: the
 * session cookie is `SameSite=Lax` on `.readfrog.app`, and the browser only
 * attaches it to the background's `get-session` request while the extension
 * holds a host permission for that URL. Without it the request still succeeds
 * and returns a `null` session, so a missing permission is indistinguishable
 * from being signed out. `WXT_WEBSITE_URL` rides along because the onboarding
 * content script and the changelog check need it, and asking for both in one
 * prompt beats prompting twice.
 *
 * These fall under the all-sites `host_permissions` entry in the manifest, not
 * `optional_permissions`. Both Chrome and Firefox allow re-requesting a
 * required permission the user withheld, which is exactly this case.
 */
export const ACCOUNT_ORIGIN_PATTERNS = [
  ...new Set([env.WXT_API_URL, env.WXT_WEBSITE_URL].map(toOriginPattern)),
]

export async function hasAccountHostPermission(): Promise<boolean> {
  try {
    return await browser.permissions.contains({ origins: ACCOUNT_ORIGIN_PATTERNS })
  } catch (error) {
    // Can't tell. Assume granted: a probe failure turning every signed-out user
    // into a "grant access" prompt is worse than missing the real case.
    logger.warn("[HostPermission] Could not read host permission state:", error)
    return true
  }
}

/**
 * Must be called from a user-gesture handler, so this only works from the popup
 * or options page — a background service worker has no gesture to attach to.
 * Resolves false when the user dismisses the browser's prompt.
 */
export async function requestAccountHostPermission(): Promise<boolean> {
  return await browser.permissions.request({ origins: ACCOUNT_ORIGIN_PATTERNS })
}
