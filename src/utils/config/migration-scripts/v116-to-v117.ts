/**
 * Migration script from v116 to v117
 * - Adds `videoSubtitles.pauseOnHover`, whether resting the pointer on the
 *   subtitles pauses the video. Off: readers found the pause getting in the
 *   way, so it is now something to turn on rather than the only behavior.
 *
 * Idempotent: a config that already has the field is returned by identity.
 *
 * IMPORTANT: The default is hardcoded inline. Migration scripts are frozen
 * snapshots - never import constants, helpers, or shared types.
 */
export function migrate(oldConfig: any): any {
  const videoSubtitles = oldConfig?.videoSubtitles
  if (
    !videoSubtitles ||
    typeof videoSubtitles !== "object" ||
    Array.isArray(videoSubtitles) ||
    typeof videoSubtitles.pauseOnHover === "boolean"
  ) {
    return oldConfig
  }

  return {
    ...oldConfig,
    videoSubtitles: { ...videoSubtitles, pauseOnHover: false },
  }
}
