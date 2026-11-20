/**
 * Migration script from v126 to v127
 * - Built-in AI stops being two tiers and becomes one provider per model, with
 *   ids of the form `read-frog-ai:<model id>`. Every stored reference to a tier
 *   moves to a model:
 *   - `read-frog-free-ai` (the normal tier) -> GPT-6 Luna, the model it ran
 *   - `read-frog-advance-ai` (the advance tier) -> GPT-6 Luna as well, the
 *     model it ran too, so nobody's output or credit use changes
 *   References live in every feature's `providerId`, language detection's,
 *   every selection toolbar action's, and the translation hub's
 *   `selectedProviderIds`, where the two tiers can collapse into one model and
 *   are de-duplicated.
 * - Adds `builtInAi: { models: {} }`, the settings kept per model (the
 *   reasoning level). Empty: every model starts on its own default.
 *
 * Idempotent: a config with no tier id left and a `builtInAi` object is
 * returned by identity.
 *
 * IMPORTANT: The ids are hardcoded inline. Migration scripts are frozen
 * snapshots - never import constants, helpers, or shared types.
 */

const TIER_MODEL_PROVIDER_IDS: Record<string, string> = {
  "read-frog-free-ai": "read-frog-ai:gpt-6-luna",
  "read-frog-advance-ai": "read-frog-ai:gpt-6-luna",
}

function isPlainObject(value: unknown): value is Record<string, any> {
  return !!value && typeof value === "object" && !Array.isArray(value)
}

function isTierId(value: unknown): value is string {
  return typeof value === "string" && Object.hasOwn(TIER_MODEL_PROVIDER_IDS, value)
}

/** `holder` with its `providerId` moved to a model, or `holder` itself when it names no tier. */
function migrateProviderIdHolder(holder: unknown): unknown {
  if (!isPlainObject(holder) || !isTierId(holder.providerId)) {
    return holder
  }
  return { ...holder, providerId: TIER_MODEL_PROVIDER_IDS[holder.providerId] }
}

/** Every value of a record of `providerId` holders, migrated; the record itself when none changed. */
function migrateProviderIdHolderRecord(record: unknown): unknown {
  if (!isPlainObject(record)) {
    return record
  }
  let changed = false
  const next: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(record)) {
    next[key] = migrateProviderIdHolder(value)
    changed ||= next[key] !== value
  }
  return changed ? next : record
}

function migrateSelectionToolbar(selectionToolbar: unknown): unknown {
  if (!isPlainObject(selectionToolbar)) {
    return selectionToolbar
  }

  const features = migrateProviderIdHolderRecord(selectionToolbar.features)
  const builtInActions = migrateProviderIdHolderRecord(selectionToolbar.builtInActions)
  const noteSuggestion = migrateProviderIdHolder(selectionToolbar.noteSuggestion)
  const customActions = Array.isArray(selectionToolbar.customActions)
    ? selectionToolbar.customActions.map(migrateProviderIdHolder)
    : selectionToolbar.customActions
  const customActionsChanged =
    Array.isArray(customActions) &&
    customActions.some((action, index) => action !== selectionToolbar.customActions[index])

  if (
    features === selectionToolbar.features &&
    builtInActions === selectionToolbar.builtInActions &&
    noteSuggestion === selectionToolbar.noteSuggestion &&
    !customActionsChanged
  ) {
    return selectionToolbar
  }

  return {
    ...selectionToolbar,
    ...(features !== undefined && { features }),
    ...(builtInActions !== undefined && { builtInActions }),
    ...(noteSuggestion !== undefined && { noteSuggestion }),
    ...(customActions !== undefined && { customActions }),
  }
}

function migrateTranslationHub(translationHub: unknown): unknown {
  if (
    !isPlainObject(translationHub) ||
    !Array.isArray(translationHub.selectedProviderIds) ||
    !translationHub.selectedProviderIds.some(isTierId)
  ) {
    return translationHub
  }

  // Both tiers can name the same model now; the hub shows one card per id.
  const selectedProviderIds = [
    ...new Set(
      translationHub.selectedProviderIds.map((id: unknown) =>
        isTierId(id) ? TIER_MODEL_PROVIDER_IDS[id] : id,
      ),
    ),
  ]
  return { ...translationHub, selectedProviderIds }
}

export function migrate(oldConfig: any): any {
  if (!isPlainObject(oldConfig)) {
    return oldConfig
  }

  const next: Record<string, unknown> = { ...oldConfig }
  let changed = false
  const assign = (key: string, value: unknown) => {
    if (value !== oldConfig[key]) {
      next[key] = value
      changed = true
    }
  }

  for (const key of [
    "pageTranslation",
    "videoSubtitles",
    "inputTranslation",
    "languageDetection",
  ]) {
    assign(key, migrateProviderIdHolder(oldConfig[key]))
  }
  assign("selectionToolbar", migrateSelectionToolbar(oldConfig.selectionToolbar))
  assign("translationHub", migrateTranslationHub(oldConfig.translationHub))

  if (!isPlainObject(oldConfig.builtInAi)) {
    next.builtInAi = { models: {} }
    changed = true
  }

  return changed ? next : oldConfig
}
