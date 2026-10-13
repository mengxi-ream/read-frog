/**
 * Migration script from v111 to v112
 * - Adds `pageTranslation.node.shortcut` ("Alt+Q"), the key combination
 *   paragraph translation listens for when `node.hotkey` is the new "custom".
 *   No config chose "custom" before v112, so the key does nothing until the
 *   reader picks it; it is not checked against the reader's other shortcuts
 *   here, and the Shortcuts page flags a clash once it is in use.
 *
 * The CONFIG_SCHEMA_VERSION bump is also what protects sync: an older build
 * refuses a v112 config instead of failing to parse `hotkey: "custom"`, a
 * value its schema does not know, and falling back to the default config.
 *
 * Idempotent: a config that already has a shortcut keeps it and is returned
 * by identity.
 *
 * IMPORTANT: The default is hardcoded inline. Migration scripts are frozen
 * snapshots - never import constants, helpers, or shared types.
 */
export function migrate(oldConfig: any): any {
  if (
    !oldConfig ||
    typeof oldConfig !== "object" ||
    Array.isArray(oldConfig) ||
    !oldConfig.pageTranslation ||
    typeof oldConfig.pageTranslation !== "object" ||
    Array.isArray(oldConfig.pageTranslation) ||
    !oldConfig.pageTranslation.node ||
    typeof oldConfig.pageTranslation.node !== "object" ||
    Array.isArray(oldConfig.pageTranslation.node)
  ) {
    return oldConfig
  }

  if (typeof oldConfig.pageTranslation.node.shortcut === "string") {
    return oldConfig
  }

  return {
    ...oldConfig,
    pageTranslation: {
      ...oldConfig.pageTranslation,
      node: {
        ...oldConfig.pageTranslation.node,
        shortcut: "Alt+Q",
      },
    },
  }
}
