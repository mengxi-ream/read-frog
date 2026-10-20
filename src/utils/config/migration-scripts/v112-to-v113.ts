/**
 * Migration script from v112 to v113
 * - Splits `videoSubtitles.autoStart` from one boolean into one switch per
 *   platform: `{ youtube, xcom, netflix }`. Each platform takes the old value,
 *   so a reader who had translate-on-open on keeps it everywhere, and one who
 *   had it off still starts nothing until they turn a platform on.
 *
 * The CONFIG_SCHEMA_VERSION bump is also what protects sync: an older build
 * refuses a v113 config instead of failing to parse an object where its
 * schema expects a boolean, and falling back to the default config.
 *
 * Idempotent: a config whose `autoStart` is already an object is returned by
 * identity.
 *
 * IMPORTANT: The platform list is hardcoded inline. Migration scripts are
 * frozen snapshots - never import constants, helpers, or shared types.
 */
export function migrate(oldConfig: any): any {
  if (
    !oldConfig ||
    typeof oldConfig !== "object" ||
    Array.isArray(oldConfig) ||
    !oldConfig.videoSubtitles ||
    typeof oldConfig.videoSubtitles !== "object" ||
    Array.isArray(oldConfig.videoSubtitles)
  ) {
    return oldConfig
  }

  const { autoStart } = oldConfig.videoSubtitles
  if (autoStart && typeof autoStart === "object" && !Array.isArray(autoStart)) {
    return oldConfig
  }

  const enabled = autoStart === true

  return {
    ...oldConfig,
    videoSubtitles: {
      ...oldConfig.videoSubtitles,
      autoStart: {
        youtube: enabled,
        xcom: enabled,
        netflix: enabled,
      },
    },
  }
}
