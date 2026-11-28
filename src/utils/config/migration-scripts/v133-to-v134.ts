/**
 * Migration script from v133 to v134
 * - Adds Prime Video to `videoSubtitles.platforms`. A reader who turned
 *   subtitles off on every site keeps them off there too; everyone else gets
 *   "manual", as a new install does.
 *
 * Idempotent: a config whose platforms already name Prime Video is returned
 * by identity.
 *
 * IMPORTANT: Migration scripts are frozen snapshots - never import constants,
 * helpers, or shared types.
 */

function isPlainObject(value: unknown): value is Record<string, any> {
  return !!value && typeof value === "object" && !Array.isArray(value)
}

export function migrate(oldConfig: any): any {
  const platforms = oldConfig?.videoSubtitles?.platforms
  if (!isPlainObject(platforms) || "primevideo" in platforms) {
    return oldConfig
  }

  const modes = Object.values(platforms)
  const primevideo = modes.length > 0 && modes.every((mode) => mode === "off") ? "off" : "manual"

  return {
    ...oldConfig,
    videoSubtitles: { ...oldConfig.videoSubtitles, platforms: { ...platforms, primevideo } },
  }
}
