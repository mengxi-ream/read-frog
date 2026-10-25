/**
 * Migration script from v114 to v115
 * - Adds `videoSubtitles.wordLookupActionId`, the AI action a click on a
 *   subtitle word runs. Existing configs get the built-in Dictionary, which is
 *   what a click already ran.
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
    typeof videoSubtitles.wordLookupActionId === "string"
  ) {
    return oldConfig
  }

  return {
    ...oldConfig,
    videoSubtitles: { ...videoSubtitles, wordLookupActionId: "default-dictionary" },
  }
}
