/**
 * Migration script from v111 to v112
 * - Adds the top-level `wordLookup` section, the custom AI actions that answer
 *   a lookup in video subtitles: `clickActionId` for a click on one word and
 *   `dragActionId` for a drag across several. Existing configs get the
 *   built-in Dictionary for a click, which is what word lookup ran before it
 *   was configurable, and the built-in Sentence Analysis for a drag.
 *
 * Idempotent: a config that already has both fields is returned by identity.
 *
 * IMPORTANT: The defaults are hardcoded inline. Migration scripts are frozen
 * snapshots - never import constants, helpers, or shared types.
 */
export function migrate(oldConfig: any): any {
  if (!oldConfig || typeof oldConfig !== "object" || Array.isArray(oldConfig)) {
    return oldConfig
  }

  const wordLookup = oldConfig.wordLookup
  if (
    wordLookup &&
    typeof wordLookup === "object" &&
    !Array.isArray(wordLookup) &&
    typeof wordLookup.clickActionId === "string" &&
    typeof wordLookup.dragActionId === "string"
  ) {
    return oldConfig
  }

  return {
    ...oldConfig,
    wordLookup: {
      clickActionId: "default-dictionary",
      dragActionId: "default-sentence-analysis",
    },
  }
}
