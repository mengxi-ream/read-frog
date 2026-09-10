/**
 * Migration script from v100 to v101.
 *
 * Two changes:
 *
 * 1. Adds the `glossary` settings section for the user terminology list. Only
 *    the enabled switch lives in config; the terms themselves live in IndexedDB,
 *    so this migration moves no user data and nothing here can fail on a large
 *    glossary.
 *
 *    `glossaryConfigSchema` carries a `.default()`, which covers a UI context
 *    that loads before the background migration runs, but the explicit step is
 *    still required: `migrateConfig` only reaches for schema defaults on whole
 *    sections, and leaving it to chance would let a stored v100 config fail
 *    `configSchema` outright and be replaced by DEFAULT_CONFIG — losing the
 *    user's providers.
 *
 * 2. Rewrites every stored website pattern so it keeps meaning what it used to.
 *    The six lists below ran on a hostname-only matcher in which a bare host
 *    covered its subdomains: `example.com` matched `www.example.com`. That
 *    matcher is gone — everything now resolves through the match-pattern engine
 *    the site rules already used, where a bare host means that exact host. The
 *    shorthand a user relied on is restored by storing `*.example.com`, whose
 *    leading `*.` matches zero or more labels and so covers the apex too.
 *
 *    Only a BARE host is rewritten. Anything carrying a path, a wildcard or a
 *    colon is left exactly as it was: it is either already a full pattern, or
 *    something the engine rejects, and in neither case did the old matcher
 *    treat it as a hostname. Patterns of that shape never matched anything
 *    before; some of them will start matching now, which is the intended
 *    outcome of finally running them through a real engine.
 *
 * Idempotent, per step rather than for the script as a whole: a bare host is
 * rewritten once (the result contains a `*`, so a second pass skips it) and the
 * glossary key is only added when absent. Running this twice is a no-op.
 *
 * IMPORTANT: This is a frozen snapshot. All values are deliberately inline and it
 * imports nothing from the evolving application code — including the live
 * `sitePatternForHost`, which is duplicated below on purpose so that a
 * later change to it cannot retroactively change what this migration did.
 */

function isObject(value: any): value is Record<string, any> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

/** Frozen copy of `sitePatternForHost` — see the note above. */
function toSitePattern(input: unknown): unknown {
  if (typeof input !== "string") {
    return input
  }
  const trimmed = input.trim()
  if (trimmed === "" || trimmed.includes("/") || trimmed.includes("*") || trimmed.includes(":")) {
    return trimmed
  }
  return `*.${trimmed.toLowerCase()}`
}

function migratePatternList(value: unknown): unknown {
  if (!Array.isArray(value)) {
    return value
  }
  return value.map(toSitePattern)
}

export function migrate(oldConfig: any): any {
  if (!isObject(oldConfig)) {
    return oldConfig
  }

  const newConfig = { ...oldConfig }

  if (!("glossary" in newConfig)) {
    newConfig.glossary = { enabled: true }
  }

  if (isObject(newConfig.pageTranslation) && isObject(newConfig.pageTranslation.page)) {
    newConfig.pageTranslation = {
      ...newConfig.pageTranslation,
      page: {
        ...newConfig.pageTranslation.page,
        autoTranslatePatterns: migratePatternList(
          newConfig.pageTranslation.page.autoTranslatePatterns,
        ),
        neverAutoTranslatePatterns: migratePatternList(
          newConfig.pageTranslation.page.neverAutoTranslatePatterns,
        ),
      },
    }
  }

  if (isObject(newConfig.siteControl)) {
    newConfig.siteControl = {
      ...newConfig.siteControl,
      blacklistPatterns: migratePatternList(newConfig.siteControl.blacklistPatterns),
      whitelistPatterns: migratePatternList(newConfig.siteControl.whitelistPatterns),
    }
  }

  if (isObject(newConfig.floatingButton)) {
    newConfig.floatingButton = {
      ...newConfig.floatingButton,
      disabledFloatingButtonPatterns: migratePatternList(
        newConfig.floatingButton.disabledFloatingButtonPatterns,
      ),
    }
  }

  if (isObject(newConfig.selectionToolbar)) {
    newConfig.selectionToolbar = {
      ...newConfig.selectionToolbar,
      disabledSelectionToolbarPatterns: migratePatternList(
        newConfig.selectionToolbar.disabledSelectionToolbarPatterns,
      ),
    }
  }

  return newConfig
}
