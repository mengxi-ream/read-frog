/**
 * Migration script from v130 to v131
 * - Every Built-in AI reference to a normal-tier model other than Claude Haiku
 *   5.5 moves to Claude Haiku 5.5, the model new installs start on:
 *   - `read-frog-ai:gpt-6-luna` (GPT-6 Luna, where v127 put both old tiers)
 *   - `read-frog-ai:deepseek-v4.1-flash` (DeepSeek V4.1 Flash)
 *   - `read-frog-free-ai` and `read-frog-advance-ai`, the tier ids from before
 *     v127, in case one is still stored
 *   A stored config cannot tell a model the user picked from one it started
 *   on, so a picked Luna or DeepSeek moves too. The advance-tier models (GPT-6.2
 *   Sol, Claude Sonnet 5.5) and every other provider stay.
 *   References live where v127 moved them: every feature's `providerId`,
 *   language detection's, every selection toolbar action's, and the
 *   translation hub's `selectedProviderIds`, where several can collapse into
 *   one card and are de-duplicated, each id kept where it first was.
 * - `builtInAi.models` stays as is: Haiku starts on its own reasoning default,
 *   and the old models keep theirs in case the user switches back.
 *
 * Idempotent: a config with nothing to move is returned by identity. A missing
 * or malformed section is left for the schema parse that follows.
 *
 * IMPORTANT: The ids are hardcoded inline. Migration scripts are frozen
 * snapshots - never import constants, helpers, or shared types.
 */

const HAIKU_PROVIDER_ID = "read-frog-ai:claude-haiku-5-5"

const MOVED_PROVIDER_IDS = new Set([
  "read-frog-ai:gpt-6-luna",
  "read-frog-ai:deepseek-v4.1-flash",
  "read-frog-free-ai",
  "read-frog-advance-ai",
])

function isPlainObject(value: unknown): value is Record<string, any> {
  return !!value && typeof value === "object" && !Array.isArray(value)
}

function isMovedId(value: unknown): value is string {
  return typeof value === "string" && MOVED_PROVIDER_IDS.has(value)
}

/** `holder` with its `providerId` moved to Haiku, or `holder` itself when it names nothing to move. */
function migrateProviderIdHolder(holder: unknown): unknown {
  if (!isPlainObject(holder) || !isMovedId(holder.providerId)) {
    return holder
  }
  return { ...holder, providerId: HAIKU_PROVIDER_ID }
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
    !translationHub.selectedProviderIds.some(isMovedId)
  ) {
    return translationHub
  }

  // Luna, DeepSeek and Haiku can all be selected; the hub shows one card per id.
  const selectedProviderIds = [
    ...new Set(
      translationHub.selectedProviderIds.map((id: unknown) =>
        isMovedId(id) ? HAIKU_PROVIDER_ID : id,
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

  return changed ? next : oldConfig
}
