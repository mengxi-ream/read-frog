/**
 * Migration script from v096 to v097.
 *
 * Renames the advanced built-in provider id from `read-frog-ultra-ai` to
 * `read-frog-advance-ai`. "Ultra" is the name of a billing plan; the provider
 * runs the hosted `advance` model tier, and the two are independent — which
 * plans may reach which tier is server-side policy. Naming the provider after
 * the plan made that pairing look like a definition.
 *
 * Written as its own step rather than as an edit to v096, even though v096 is
 * unreleased: `migrateConfig` only runs steps *above* the stored version, so
 * editing v096 in place would leave any profile already at v096 holding the
 * old id, and the renamed provider then fails `configSchema`'s capability
 * check and resets the profile. Only a v097 step can reach those configs.
 *
 * The id is persisted at eight paths. `languageDetection.providerId` is
 * included even though today's schema rejects a built-in provider there — it
 * becomes legal when language detection gains a hosted route, and rewriting a
 * key that is absent is a no-op either way.
 *
 * IMPORTANT: This is a frozen snapshot. All values and helpers are deliberately inline and it
 * imports nothing from the evolving application code.
 */

const OLD_PROVIDER_ID = "read-frog-ultra-ai"
const NEW_PROVIDER_ID = "read-frog-advance-ai"

function isObject(value: any): value is Record<string, any> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

/** Rewrites `providerId` on `holder` when it is the renamed id. Returns a copy only on a hit. */
function renameProviderId(holder: any): any {
  if (!isObject(holder) || holder.providerId !== OLD_PROVIDER_ID) {
    return holder
  }
  return { ...holder, providerId: NEW_PROVIDER_ID }
}

export function migrate(oldConfig: any): any {
  if (!isObject(oldConfig)) {
    return oldConfig
  }

  const next: Record<string, any> = { ...oldConfig }

  // Top-level feature sections.
  for (const key of [
    "pageTranslation",
    "videoSubtitles",
    "inputTranslation",
    "languageDetection",
  ]) {
    next[key] = renameProviderId(next[key])
  }

  const selectionToolbar = next.selectionToolbar
  if (isObject(selectionToolbar)) {
    const nextSelectionToolbar: Record<string, any> = { ...selectionToolbar }

    nextSelectionToolbar.noteSuggestion = renameProviderId(nextSelectionToolbar.noteSuggestion)

    const features = nextSelectionToolbar.features
    if (isObject(features)) {
      nextSelectionToolbar.features = {
        ...features,
        translate: renameProviderId(features.translate),
      }
    }

    const builtInActions = nextSelectionToolbar.builtInActions
    if (isObject(builtInActions)) {
      nextSelectionToolbar.builtInActions = {
        ...builtInActions,
        dictionary: renameProviderId(builtInActions.dictionary),
      }
    }

    if (Array.isArray(nextSelectionToolbar.customActions)) {
      nextSelectionToolbar.customActions = nextSelectionToolbar.customActions.map(renameProviderId)
    }

    next.selectionToolbar = nextSelectionToolbar
  }

  return next
}
