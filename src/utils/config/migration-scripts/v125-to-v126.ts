/**
 * Migration script from v125 to v126
 * - Replaces `videoSubtitles.enabled` (one switch for every site) and
 *   `videoSubtitles.autoStart` (one switch per site) with
 *   `videoSubtitles.platforms`, one mode per site:
 *   - "off" for every site when `enabled` was false
 *   - otherwise "auto" where `autoStart` was on, "manual" elsewhere
 *
 * Idempotent: a config whose `videoSubtitles` has neither old field is
 * returned by identity.
 *
 * IMPORTANT: The platform list is hardcoded inline. Migration scripts are
 * frozen snapshots - never import constants, helpers, or shared types.
 */

const PLATFORMS = ["youtube", "xcom", "netflix", "bilibili", "udemy", "edx"]

function isPlainObject(value: unknown): value is Record<string, any> {
  return !!value && typeof value === "object" && !Array.isArray(value)
}

export function migrate(oldConfig: any): any {
  const videoSubtitles = oldConfig?.videoSubtitles
  if (!isPlainObject(oldConfig) || !isPlainObject(videoSubtitles)) {
    return oldConfig
  }
  if (!("enabled" in videoSubtitles) && !("autoStart" in videoSubtitles)) {
    return oldConfig
  }

  // A `platforms` already next to the old fields can only hold the schema's
  // defaults, written back while the config waited for this migration, so the
  // old fields win over it.
  const { enabled, autoStart, platforms: _defaults, ...rest } = videoSubtitles
  const autoStartBySite = isPlainObject(autoStart) ? autoStart : {}

  const platforms: Record<string, string> = {}
  for (const platform of PLATFORMS) {
    platforms[platform] =
      enabled === false ? "off" : autoStartBySite[platform] === true ? "auto" : "manual"
  }

  return {
    ...oldConfig,
    videoSubtitles: { ...rest, platforms },
  }
}
