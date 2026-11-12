import { setupLogging } from "./logger"
import { createDevConsoleSinks } from "./sinks/console"
import { createPersistSink } from "./sinks/persist"
import { captureUncaughtErrors } from "./uncaught"

/**
 * Logging for the background, which writes the local log itself. Kept apart
 * from `setup.ts` so the other bundles do not pull in the database.
 */
export function setupBackgroundLogging(): void {
  setupLogging([createPersistSink(), ...createDevConsoleSinks()])
  captureUncaughtErrors()
}
