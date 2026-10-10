/**
 * Migration script from v109 to v110
 * - Adds the top-level `wordLookup` section with `actionId`, the custom AI
 *   action that answers a click on a word in video subtitles. Existing configs
 *   get the built-in Dictionary, which is what word lookup ran before it was
 *   configurable.
 *
 * Idempotent: a config that already has the section is returned by identity.
 *
 * IMPORTANT: The default is hardcoded inline. Migration scripts are frozen
 * snapshots - never import constants, helpers, or shared types.
 */
export function migrate(oldConfig: any): any {
  if (!oldConfig || typeof oldConfig !== "object" || Array.isArray(oldConfig)) {
    return oldConfig
  }

  if (
    oldConfig.wordLookup &&
    typeof oldConfig.wordLookup === "object" &&
    !Array.isArray(oldConfig.wordLookup) &&
    typeof oldConfig.wordLookup.actionId === "string"
  ) {
    return oldConfig
  }

  return {
    ...oldConfig,
    wordLookup: {
      actionId: "default-dictionary",
    },
  }
}
