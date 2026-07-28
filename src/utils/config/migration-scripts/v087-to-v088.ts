/**
 * Migration script from v087 to v088
 * - Moves the legacy default Dictionary action into code-owned built-in action state.
 * - Preserves customized Dictionary actions under a deterministic custom id.
 * - Pins Save Suggestion to Dictionary unless an action was already selected.
 *
 * IMPORTANT: All ids, fingerprints, and defaults are hardcoded inline. Migration
 * scripts are frozen snapshots - never import constants, helpers, or shared types.
 */

const BUILT_IN_DICTIONARY_ACTION_ID = "default-dictionary"
const BUILT_IN_AI_PROVIDER_ID = "read-frog-free-ai"
const MIGRATED_CUSTOM_DICTIONARY_ID = "migrated-default-dictionary"

const CURRENT_DICTIONARY_OUTPUT_FIELD_IDS = [
  "default-dictionary-term",
  "default-dictionary-phonetic",
  "default-dictionary-part-of-speech",
  "default-dictionary-definition",
  "default-dictionary-context",
  "default-dictionary-context-translation",
  "default-dictionary-difficulty",
]

/**
 * Frozen fingerprints of Dictionary definitions shipped before v088 after all
 * earlier migrations have run. Mutable enabled/provider/Notebase fields are
 * deliberately excluded from the fingerprint.
 */
const OFFICIAL_DICTIONARY_FINGERPRINTS = new Set([
  // Initial six-field English Dictionary.
  "1121:3444282299:183221701",
  // Improved four-field English Dictionary.
  "2312:359857760:334930778",
  // Seven-field English Dictionary before the part-of-speech id stabilized.
  "3049:3013929056:1561436142",
  // Stable seven-field English and Simplified Chinese definitions.
  "3059:4188453194:2907333164",
  "2000:188708879:2610563245",
  // Latest definitions shipped in English/fallback, Spanish, Simplified Chinese,
  // and Traditional Chinese.
  "3065:2524821398:25301960",
  "3203:1045736862:3801979576",
  "2006:1376452269:493447175",
  "2013:71462063:1926574897",
])

function definitionFingerprint(action: any): string {
  const serialized = JSON.stringify({
    id: action?.id,
    name: action?.name,
    icon: action?.icon,
    systemPrompt: action?.systemPrompt,
    prompt: action?.prompt,
    outputSchema: Array.isArray(action?.outputSchema)
      ? action.outputSchema.map((field: any) => ({
          id: field?.id,
          name: field?.name,
          type: field?.type,
          description: field?.description,
          speaking: field?.speaking,
        }))
      : action?.outputSchema,
  })

  let first = 2166136261
  let second = 3339675911
  for (let index = 0; index < serialized.length; index += 1) {
    const code = serialized.charCodeAt(index)
    first = Math.imul(first ^ code, 16777619)
    second = Math.imul(second ^ code, 2246822519)
  }

  return `${serialized.length}:${first >>> 0}:${second >>> 0}`
}

function isValidActionProvider(oldConfig: any, providerId: any): boolean {
  if (providerId === BUILT_IN_AI_PROVIDER_ID) {
    return true
  }
  if (typeof providerId !== "string" || !Array.isArray(oldConfig?.providersConfig)) {
    return false
  }

  return oldConfig.providersConfig.some(
    (provider: any) =>
      provider?.id === providerId &&
      provider?.enabled === true &&
      provider?.model &&
      typeof provider.model === "object" &&
      !Array.isArray(provider.model),
  )
}

function getInheritedProviderId(oldConfig: any, legacyAction: any): string {
  return isValidActionProvider(oldConfig, legacyAction?.providerId)
    ? legacyAction.providerId
    : BUILT_IN_AI_PROVIDER_ID
}

function hasCurrentDictionaryOutputSchema(action: any): boolean {
  if (!Array.isArray(action?.outputSchema)) {
    return false
  }
  return (
    action.outputSchema.length === CURRENT_DICTIONARY_OUTPUT_FIELD_IDS.length &&
    action.outputSchema.every(
      (field: any, index: number) => field?.id === CURRENT_DICTIONARY_OUTPUT_FIELD_IDS[index],
    )
  )
}

function hasCompatibleCurrentDictionaryConnection(action: any): boolean {
  if (!action?.notebaseConnection) {
    return true
  }
  if (
    !hasCurrentDictionaryOutputSchema(action) ||
    !Array.isArray(action.notebaseConnection.mappings)
  ) {
    return false
  }

  const currentFieldIds = new Set(CURRENT_DICTIONARY_OUTPUT_FIELD_IDS)
  return action.notebaseConnection.mappings.every(
    (mapping: any) =>
      typeof mapping?.localFieldId === "string" && currentFieldIds.has(mapping.localFieldId),
  )
}

function outputSchemaFingerprint(action: any): string {
  if (!Array.isArray(action?.outputSchema)) {
    return ""
  }
  return JSON.stringify(
    action.outputSchema.map((field: any) => ({
      id: field?.id,
      name: field?.name,
      type: field?.type,
    })),
  )
}

function nextMigratedCustomId(actions: any[]): string {
  const ids = new Set(actions.map((action: any) => action?.id))
  if (!ids.has(MIGRATED_CUSTOM_DICTIONARY_ID)) {
    return MIGRATED_CUSTOM_DICTIONARY_ID
  }

  let suffix = 2
  while (ids.has(`${MIGRATED_CUSTOM_DICTIONARY_ID}-${suffix}`)) {
    suffix += 1
  }
  return `${MIGRATED_CUSTOM_DICTIONARY_ID}-${suffix}`
}

function createBuiltInState(providerId: string, enabled: boolean, notebaseConnection?: any): any {
  return {
    enabled,
    providerId,
    ...(notebaseConnection ? { notebaseConnection } : {}),
  }
}

export function migrate(oldConfig: any): any {
  if (
    !oldConfig ||
    typeof oldConfig !== "object" ||
    Array.isArray(oldConfig) ||
    !oldConfig.selectionToolbar ||
    typeof oldConfig.selectionToolbar !== "object" ||
    !Array.isArray(oldConfig.selectionToolbar.customActions)
  ) {
    return oldConfig
  }

  const oldSelectionToolbar = oldConfig.selectionToolbar
  const existingSaveSuggestion = oldSelectionToolbar.saveSuggestion
  const isSaveSuggestionObject =
    existingSaveSuggestion &&
    typeof existingSaveSuggestion === "object" &&
    !Array.isArray(existingSaveSuggestion)
  const hasSaveSuggestionEnabled =
    isSaveSuggestionObject && typeof existingSaveSuggestion.enabled === "boolean"
  const hasSaveSuggestionActionId =
    isSaveSuggestionObject &&
    typeof existingSaveSuggestion.actionId === "string" &&
    (existingSaveSuggestion.actionId === BUILT_IN_DICTIONARY_ACTION_ID ||
      oldSelectionToolbar.customActions.some(
        (action: any) => action?.id === existingSaveSuggestion.actionId,
      ))
  const selectionToolbar =
    hasSaveSuggestionEnabled && hasSaveSuggestionActionId
      ? oldSelectionToolbar
      : {
          ...oldSelectionToolbar,
          saveSuggestion: {
            ...(isSaveSuggestionObject ? existingSaveSuggestion : {}),
            enabled: hasSaveSuggestionEnabled ? existingSaveSuggestion.enabled : true,
            actionId: hasSaveSuggestionActionId
              ? existingSaveSuggestion.actionId
              : BUILT_IN_DICTIONARY_ACTION_ID,
          },
        }
  const existingBuiltInState = selectionToolbar.builtInActions?.dictionary
  const legacyAction = selectionToolbar.customActions.find(
    (action: any) => action?.id === BUILT_IN_DICTIONARY_ACTION_ID,
  )

  if (existingBuiltInState) {
    if (!legacyAction) {
      return selectionToolbar === oldSelectionToolbar
        ? oldConfig
        : {
            ...oldConfig,
            selectionToolbar,
          }
    }

    const rekeyedActions = selectionToolbar.customActions.map((action: any) =>
      action === legacyAction
        ? {
            ...action,
            id: nextMigratedCustomId(selectionToolbar.customActions),
          }
        : action,
    )
    return {
      ...oldConfig,
      selectionToolbar: {
        ...selectionToolbar,
        customActions: rekeyedActions,
      },
    }
  }

  if (!legacyAction) {
    return {
      ...oldConfig,
      selectionToolbar: {
        ...selectionToolbar,
        builtInActions: {
          dictionary: createBuiltInState(BUILT_IN_AI_PROVIDER_ID, false),
        },
      },
    }
  }

  const providerId = getInheritedProviderId(oldConfig, legacyAction)
  const isOfficial = OFFICIAL_DICTIONARY_FINGERPRINTS.has(definitionFingerprint(legacyAction))
  const hasIncompatibleConnectedSchema = !hasCompatibleCurrentDictionaryConnection(legacyAction)
  const preserveAsCustom = !isOfficial || hasIncompatibleConnectedSchema

  if (!preserveAsCustom) {
    return {
      ...oldConfig,
      selectionToolbar: {
        ...selectionToolbar,
        builtInActions: {
          dictionary: createBuiltInState(
            providerId,
            legacyAction.enabled !== false,
            legacyAction.notebaseConnection,
          ),
        },
        customActions: selectionToolbar.customActions.filter(
          (action: any) => action !== legacyAction,
        ),
      },
    }
  }

  const rekeyedLegacyAction = {
    ...legacyAction,
    id: nextMigratedCustomId(selectionToolbar.customActions),
    providerId,
  }
  const saveSuggestion =
    hasSaveSuggestionActionId && existingSaveSuggestion.actionId === BUILT_IN_DICTIONARY_ACTION_ID
      ? {
          ...selectionToolbar.saveSuggestion,
          actionId: rekeyedLegacyAction.id,
        }
      : selectionToolbar.saveSuggestion
  return {
    ...oldConfig,
    selectionToolbar: {
      ...selectionToolbar,
      saveSuggestion,
      builtInActions: {
        dictionary: createBuiltInState(providerId, legacyAction.enabled === false),
      },
      customActions: selectionToolbar.customActions.map((action: any) =>
        action === legacyAction ? rekeyedLegacyAction : action,
      ),
    },
  }
}

export function getPendingDictionaryRekeyedActionId(
  oldConfig: any,
  pendingSave: any,
): string | null {
  if (
    pendingSave?.actionId !== BUILT_IN_DICTIONARY_ACTION_ID ||
    typeof pendingSave?.outputSchemaFingerprint !== "string" ||
    !oldConfig?.selectionToolbar ||
    !Array.isArray(oldConfig.selectionToolbar.customActions)
  ) {
    return null
  }

  const legacyAction = oldConfig.selectionToolbar.customActions.find(
    (action: any) => action?.id === BUILT_IN_DICTIONARY_ACTION_ID,
  )
  if (
    !legacyAction ||
    outputSchemaFingerprint(legacyAction) !== pendingSave.outputSchemaFingerprint
  ) {
    return null
  }

  return nextMigratedCustomId(oldConfig.selectionToolbar.customActions)
}

/**
 * Local startup safety path for a v87 Notebase save that was persisted before
 * the config migration. The exact legacy Dictionary that owns the in-flight
 * payload is retained under a deterministic custom id, even when its definition
 * otherwise matches an official historical snapshot.
 */
export function migrateWithPendingDictionarySave(oldConfig: any, pendingSave: any): any {
  const migrated = migrate(oldConfig)
  const rekeyedActionId = getPendingDictionaryRekeyedActionId(oldConfig, pendingSave)
  if (!rekeyedActionId) {
    return migrated
  }

  const legacyActions = oldConfig.selectionToolbar.customActions
  const legacyActionIndex = legacyActions.findIndex(
    (action: any) => action?.id === BUILT_IN_DICTIONARY_ACTION_ID,
  )
  const legacyAction = legacyActions[legacyActionIndex]
  if (
    !legacyAction ||
    !migrated?.selectionToolbar ||
    !Array.isArray(migrated.selectionToolbar.customActions)
  ) {
    return migrated
  }

  const alreadyPreserved = migrated.selectionToolbar.customActions.find(
    (action: any) => action?.id === rekeyedActionId,
  )
  if (alreadyPreserved) {
    return migrated
  }

  const providerId = getInheritedProviderId(oldConfig, legacyAction)
  const rekeyedAction = {
    ...legacyAction,
    id: rekeyedActionId,
    providerId,
  }
  const shouldRekeySaveSuggestionAction =
    !oldConfig.selectionToolbar.builtInActions?.dictionary &&
    oldConfig.selectionToolbar.saveSuggestion?.actionId === BUILT_IN_DICTIONARY_ACTION_ID
  const customActions = [...migrated.selectionToolbar.customActions]
  customActions.splice(Math.min(legacyActionIndex, customActions.length), 0, rekeyedAction)

  return {
    ...migrated,
    selectionToolbar: {
      ...migrated.selectionToolbar,
      saveSuggestion: shouldRekeySaveSuggestionAction
        ? {
            ...migrated.selectionToolbar.saveSuggestion,
            actionId: rekeyedActionId,
          }
        : migrated.selectionToolbar.saveSuggestion,
      builtInActions: {
        dictionary: createBuiltInState(providerId, legacyAction.enabled === false),
      },
      customActions,
    },
  }
}
