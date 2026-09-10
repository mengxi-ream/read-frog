/**
 * Migration script from v100 to v101.
 *
 * Adds the `glossary` settings section for the user terminology list. Only the
 * enabled switch lives in config; the terms themselves live in IndexedDB, so this
 * migration moves no user data and nothing here can fail on a large glossary.
 *
 * `glossaryConfigSchema` carries a `.default()`, which covers a UI context that
 * loads before the background migration runs, but the explicit step is still
 * required: `migrateConfig` only reaches for schema defaults on whole sections,
 * and leaving it to chance would let a stored v100 config fail `configSchema`
 * outright and be replaced by DEFAULT_CONFIG — losing the user's providers.
 *
 * Idempotent: a config that already carries the key is returned by identity.
 *
 * IMPORTANT: This is a frozen snapshot. All values are deliberately inline and it
 * imports nothing from the evolving application code.
 */

function isObject(value: any): value is Record<string, any> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

export function migrate(oldConfig: any): any {
  if (!isObject(oldConfig)) {
    return oldConfig
  }

  if ("glossary" in oldConfig) {
    return oldConfig
  }

  return {
    ...oldConfig,
    glossary: {
      enabled: true,
    },
  }
}
