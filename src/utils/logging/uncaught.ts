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

interface UncaughtErrorListeners {
  error: (event: ErrorEvent) => void
  unhandledrejection: (event: PromiseRejectionEvent) => void
}

// On the realm, not in module scope: the extension's content scripts in a frame
// are separate bundles, each with its own copy of this module, yet they share
// one isolated world, where every listener would see, and store, every error.
const LISTENERS_KEY = "__READ_FROG_UNCAUGHT_ERROR_LISTENERS__"
type Realm = typeof globalThis & { [LISTENERS_KEY]?: UncaughtErrorListeners }

/**
 * Puts errors nothing caught into the log, once per realm: each call replaces
 * the listeners of the one before, so the bundle that set up last keeps them.
 * After an extension update that is the one whose runtime is still alive.
 */
export function captureUncaughtErrors({ ownOrigin }: UncaughtErrorOptions = {}): void {
  const realm = globalThis as Realm
  if (typeof realm.addEventListener !== "function") return

  const previous = realm[LISTENERS_KEY]
  if (previous) {
    realm.removeEventListener("error", previous.error)
    realm.removeEventListener("unhandledrejection", previous.unhandledrejection)
  }

  const listeners: UncaughtErrorListeners = {
    error: (event) => {
      if (IGNORED_MESSAGES.some((pattern) => pattern.test(event.message))) return
      if (ownOrigin && !event.filename?.startsWith(ownOrigin)) return
      log.error("Uncaught error", {
        error: event.error ?? event.message,
        source: event.filename ? `${event.filename}:${event.lineno}:${event.colno}` : undefined,
      })
    },
    unhandledrejection: (event) => {
      const reason: unknown = event.reason
      if (ownOrigin && !isOwnStack((reason as { stack?: unknown } | null)?.stack, ownOrigin)) return
      log.error("Unhandled promise rejection", { error: reason })
    },
  }
  realm[LISTENERS_KEY] = listeners
  realm.addEventListener("error", listeners.error)
  realm.addEventListener("unhandledrejection", listeners.unhandledrejection)
}
