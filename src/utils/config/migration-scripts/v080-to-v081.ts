/**
 * Migration script from v080 to v081
 * - Adds `modeShortcut` field to translate config with "Alt+Shift+M" default.
 *
 * IMPORTANT: All values are hardcoded inline. Migration scripts are frozen
 * snapshots - never import constants or helpers that may change.
 */

export function migrate(oldConfig: any): any {
  if (!oldConfig || typeof oldConfig !== "object") {
    return oldConfig
  }

  const translate = oldConfig.translate
  if (!translate || typeof translate !== "object") {
    return oldConfig
  }

  if ("modeShortcut" in translate) {
    return oldConfig
  }

  return {
    ...oldConfig,
    translate: {
      ...translate,
      modeShortcut: "Alt+Shift+M",
    },
  }
}
