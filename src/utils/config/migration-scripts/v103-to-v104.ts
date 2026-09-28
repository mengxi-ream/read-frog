/**
 * Migration script from v103 to v104.
 *
 * Adds the state of the built-in Sentence Analysis action,
 * `selectionToolbar.builtInActions.sentenceAnalysis`. Like the built-in
 * Dictionary, the action itself (prompt, fields, card) is code-owned and
 * generated at read time; only its enabled/provider/Notebase state is stored.
 *
 * - Provider: the built-in Dictionary's, the one the user already runs built-in
 *   actions on (the Built-in AI unless they changed it); the Built-in AI when
 *   the Dictionary has none.
 * - Enabled, unless the user already has a Sentence Analysis action of their
 *   own — one made from the Sentence Analysis preset, recognized by a field id
 *   ending in `sentence-analysis-annotations` — so the toolbar does not show
 *   the same action twice. They can still turn the built-in on.
 *
 * A config whose `builtInActions` already has the key (a second run) is
 * returned by identity. One without a `builtInActions` object is left for the
 * schema parse that follows to report.
 *
 * IMPORTANT: This is a frozen snapshot. All ids and defaults are hardcoded
 * inline; it imports nothing from the evolving application code.
 */

const BUILT_IN_AI_PROVIDER_ID = "read-frog-free-ai"
const SENTENCE_ANALYSIS_ANNOTATIONS_FIELD_ID = /(?:^|-)sentence-analysis-annotations$/

function isObject(value: any): value is Record<string, any> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function isSentenceAnalysisAction(action: any): boolean {
  return (
    isObject(action) &&
    Array.isArray(action.outputSchema) &&
    action.outputSchema.some(
      (field: any) =>
        isObject(field) &&
        typeof field.id === "string" &&
        SENTENCE_ANALYSIS_ANNOTATIONS_FIELD_ID.test(field.id),
    )
  )
}

export function migrate(oldConfig: any): any {
  if (!isObject(oldConfig)) {
    return oldConfig
  }

  const selectionToolbar = oldConfig.selectionToolbar
  if (!isObject(selectionToolbar) || !isObject(selectionToolbar.builtInActions)) {
    return oldConfig
  }

  const builtInActions = selectionToolbar.builtInActions
  if (Object.hasOwn(builtInActions, "sentenceAnalysis")) {
    return oldConfig
  }

  const dictionaryProviderId = isObject(builtInActions.dictionary)
    ? builtInActions.dictionary.providerId
    : undefined
  const providerId =
    typeof dictionaryProviderId === "string" && dictionaryProviderId !== ""
      ? dictionaryProviderId
      : BUILT_IN_AI_PROVIDER_ID
  const hasOwnSentenceAnalysis =
    Array.isArray(selectionToolbar.customActions) &&
    selectionToolbar.customActions.some(isSentenceAnalysisAction)

  return {
    ...oldConfig,
    selectionToolbar: {
      ...selectionToolbar,
      builtInActions: {
        ...builtInActions,
        sentenceAnalysis: {
          enabled: !hasOwnSentenceAnalysis,
          providerId,
        },
      },
    },
  }
}
