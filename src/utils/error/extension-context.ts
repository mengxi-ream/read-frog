import { browser } from "#imports"

/**
 * Chrome destroys the old extension instance on update, reload or reinstall,
 * but it does NOT re-inject content scripts into already-open tabs. Those
 * scripts keep running against a dead `chrome.runtime`, so the next message to
 * the background rejects with "Extension context invalidated." — and every
 * retry in place rejects the same way, because the channel itself is gone.
 * Only a page reload gets the tab a live content script again.
 */
const INVALIDATED_MESSAGE_PATTERN = /extension context (?:was |is )?invalidated/i

/**
 * `browser.runtime.id` is the authoritative liveness signal: Chrome clears it
 * on the stale side of an update while leaving the `runtime` object in place.
 */
export function isExtensionContextAlive(): boolean {
  try {
    return typeof browser.runtime?.id === "string"
  } catch {
    // Touching a torn-down runtime can throw instead of returning undefined.
    return false
  }
}

export function isExtensionContextInvalidatedError(error: unknown): boolean {
  // A dead context makes every in-flight failure unrecoverable, whatever the
  // original error said, so reloading is always the right advice here.
  if (!isExtensionContextAlive()) return true

  return INVALIDATED_MESSAGE_PATTERN.test(readErrorMessage(error))
}

function readErrorMessage(error: unknown): string {
  if (typeof error === "string") return error
  if (error instanceof Error) return error.message

  if (typeof error === "object" && error !== null) {
    const { message } = error as { message?: unknown }
    if (typeof message === "string") return message
  }

  return ""
}
