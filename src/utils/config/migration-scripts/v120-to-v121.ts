/**
 * Migration script from v120 to v121
 * - Adds Bilibili, Udemy and edX to `videoSubtitles.autoStart`, all off.
 *
 * Idempotent: a switch that is already there keeps its value.
 *
 * IMPORTANT: The platform list is hardcoded inline. Migration scripts are
 * frozen snapshots - never import constants, helpers, or shared types.
 */
export function migrate(oldConfig: any): any {
  const autoStart = oldConfig?.videoSubtitles?.autoStart
  if (
    !autoStart ||
    typeof autoStart !== "object" ||
    Array.isArray(autoStart) ||
    ("bilibili" in autoStart && "udemy" in autoStart && "edx" in autoStart)
  ) {
    return oldConfig
  }

  return {
    ...oldConfig,
    videoSubtitles: {
      ...oldConfig.videoSubtitles,
      autoStart: { bilibili: false, udemy: false, edx: false, ...autoStart },
    },
  }
}
