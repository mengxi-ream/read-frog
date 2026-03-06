/**
 * Migration script from v057 to v058
 * Adds `position` to `videoSubtitles` for persisting subtitle drag position.
 *
 * IMPORTANT: All values are hardcoded inline. Migration scripts are frozen
 * snapshots — never import constants or helpers that may change.
 */
export function migrate(oldConfig: any): any {
  const videoSubtitles = oldConfig.videoSubtitles

  if (!videoSubtitles) {
    return oldConfig
  }

  if (videoSubtitles.position) {
    return oldConfig
  }

  return {
    ...oldConfig,
    videoSubtitles: {
      ...videoSubtitles,
      position: { percent: 10, anchor: "bottom" },
    },
  }
}
