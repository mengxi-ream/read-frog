/**
 * Migration script from v058 to v059
 * - Replaces siteControl mode "all" with "blacklist"
 * - Splits shared `patterns` into `blacklistPatterns` and `whitelistPatterns`
 *
 * Before: { siteControl: { mode: "all" | "whitelist", patterns: [] } }
 * After:  { siteControl: { mode: "blacklist" | "whitelist", blacklistPatterns: [], whitelistPatterns: [] } }
 *
 * IMPORTANT: All values are hardcoded inline. Migration scripts are frozen
 * snapshots — never import constants or helpers that may change.
 */
export function migrate(oldConfig: any): any {
  const siteControl = oldConfig.siteControl
  if (!siteControl) {
    return oldConfig
  }

  const mode = siteControl.mode === "all" ? "blacklist" : siteControl.mode
  const patterns = siteControl.patterns ?? []

  return {
    ...oldConfig,
    siteControl: {
      mode,
      // Blacklist is a new concept in v058 — no prior data to migrate, always starts empty
      blacklistPatterns: [],
      whitelistPatterns: patterns,
    },
  }
}
