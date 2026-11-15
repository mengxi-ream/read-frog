/**
 * Migration script from v124 to v125
 * - Adds `timeoutMs` to the two request queue configs, the user-set time one
 *   request attempt may take before it is abandoned and retried:
 *   - `pageTranslation.requestQueueConfig`
 *   - `videoSubtitles.requestQueueConfig`
 *   Existing configs get 20000, the timeout both queues have always used.
 *
 * Idempotent: a queue config that already has a numeric timeout keeps it, and
 * a config with nothing to add is returned by identity.
 *
 * IMPORTANT: The default is hardcoded inline. Migration scripts are frozen
 * snapshots - never import constants, helpers, or shared types.
 */

const DEFAULT_REQUEST_TIMEOUT_MS = 20_000

function isPlainObject(value: unknown): value is Record<string, any> {
  return !!value && typeof value === "object" && !Array.isArray(value)
}

function withRequestTimeout(section: unknown): unknown {
  if (!isPlainObject(section) || !isPlainObject(section.requestQueueConfig)) {
    return section
  }
  if (typeof section.requestQueueConfig.timeoutMs === "number") {
    return section
  }
  return {
    ...section,
    requestQueueConfig: {
      ...section.requestQueueConfig,
      timeoutMs: DEFAULT_REQUEST_TIMEOUT_MS,
    },
  }
}

export function migrate(oldConfig: any): any {
  if (!isPlainObject(oldConfig)) {
    return oldConfig
  }

  const pageTranslation = withRequestTimeout(oldConfig.pageTranslation)
  const videoSubtitles = withRequestTimeout(oldConfig.videoSubtitles)
  if (
    pageTranslation === oldConfig.pageTranslation &&
    videoSubtitles === oldConfig.videoSubtitles
  ) {
    return oldConfig
  }

  return {
    ...oldConfig,
    ...(pageTranslation === oldConfig.pageTranslation ? {} : { pageTranslation }),
    ...(videoSubtitles === oldConfig.videoSubtitles ? {} : { videoSubtitles }),
  }
}
