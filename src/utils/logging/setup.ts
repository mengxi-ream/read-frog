import type { ForwardingLogContext } from "./stored-record"
import { browser } from "#imports"
import { setupLogging } from "./logger"
import { createDevConsoleSinks } from "./sinks/console"
import { createForwardSink } from "./sinks/forward"
import { captureUncaughtErrors } from "./uncaught"

let isSetUp = false

function setupForwardedLogging(context: ForwardingLogContext, ownOrigin?: string): void {
  if (isSetUp) return
  isSetUp = true
  setupLogging([createForwardSink(context), ...createDevConsoleSinks()])
  captureUncaughtErrors({ ownOrigin })
}

/** Logging for the extension's own pages; the background stores their records. */
export function setupExtensionPageLogging(context: Exclude<ForwardingLogContext, "content">): void {
  setupForwardedLogging(context)
}

/**
 * Logging for content scripts in the isolated world. The background stores
 * their records, tagged with the tab and the site. Scripts in the page's own
 * world (`world: "MAIN"`) have no extension APIs and skip this; they log to the
 * console in development builds only.
 */
export function setupContentScriptLogging(): void {
  // They share `window` with the site, whose errors are not ours to keep.
  setupForwardedLogging("content", browser.runtime.getURL("/"))
}
