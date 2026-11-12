import { createLogger } from "./logger"

const log = createLogger("uncaught")

/** Browser noise that is not an error in our code. */
const IGNORED_MESSAGES = [/ResizeObserver loop/i]

interface UncaughtErrorOptions {
  /**
   * Content scripts share `window` with the page, so they must only record
   * errors from the extension's own files, never the site's.
   */
  ownOrigin?: string
}

function isOwnStack(stack: unknown, ownOrigin: string): boolean {
  return typeof stack === "string" && stack.includes(ownOrigin)
}

let installed = false

/** Puts errors nothing caught into the log. Installs once per bundle. */
export function captureUncaughtErrors({ ownOrigin }: UncaughtErrorOptions = {}): void {
  if (installed || typeof globalThis.addEventListener !== "function") return
  installed = true

  globalThis.addEventListener("error", (event: ErrorEvent) => {
    if (IGNORED_MESSAGES.some((pattern) => pattern.test(event.message))) return
    if (ownOrigin && !event.filename?.startsWith(ownOrigin)) return
    log.error("Uncaught error", {
      error: event.error ?? event.message,
      source: event.filename ? `${event.filename}:${event.lineno}:${event.colno}` : undefined,
    })
  })

  globalThis.addEventListener("unhandledrejection", (event: PromiseRejectionEvent) => {
    const reason: unknown = event.reason
    if (ownOrigin && !isOwnStack((reason as { stack?: unknown } | null)?.stack, ownOrigin)) return
    log.error("Unhandled promise rejection", { error: reason })
  })
}
