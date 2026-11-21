import { storage } from "#imports"

/**
 * Session storage outlives the service worker, which restarts all the time, and is
 * cleared when the browser closes: exactly "once a browser session".
 */
const AUTO_PROMPT_SHOWN_STORAGE_KEY = "session:builtInAiAutoPromptShown"

let pendingClaim: Promise<unknown> = Promise.resolve()

/**
 * Whether automatic page translation may ask to upgrade in a dialog: true the first time
 * in a browser session, false after. Every page someone opens translates on its own, so
 * a dialog on each would be a dialog on every page; after the first, the pages that run
 * dry say so in a toast with the same button.
 *
 * Claims run one at a time, so two tabs that run dry together don't both get true.
 */
export function claimBuiltInAiAutoPrompt(): Promise<boolean> {
  const claim = pendingClaim.then(async () => {
    if (await storage.getItem<boolean>(AUTO_PROMPT_SHOWN_STORAGE_KEY)) {
      return false
    }
    await storage.setItem(AUTO_PROMPT_SHOWN_STORAGE_KEY, true)
    return true
  })
  pendingClaim = claim.catch(() => undefined)
  return claim
}
