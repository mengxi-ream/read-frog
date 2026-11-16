export const TRANSLATION_STATE_KEY_PREFIX = "session:translationState" as const

export function getTranslationStateKey(tabId: number): `session:translationState.${number}` {
  return `${TRANSLATION_STATE_KEY_PREFIX}.${tabId}` as const
}

export function parseTabIdFromStorageKey(key: string): number {
  const parts = key.split(".")
  return Number.parseInt(parts[1] ?? "", 10)
}

export const DETECTED_CODE_STATE_KEY_PREFIX = "session:detectedCode" as const

export function getDetectedCodeStateKey(tabId: number): `session:detectedCode.${number}` {
  return `${DETECTED_CODE_STATE_KEY_PREFIX}.${tabId}` as const
}

export const SELECTION_TOOLBAR_HIDDEN_KEY_PREFIX =
  "session:selectionToolbarHiddenUntilReload" as const

export function getSelectionToolbarHiddenKey(
  tabId: number,
): `session:selectionToolbarHiddenUntilReload.${number}` {
  return `${SELECTION_TOOLBAR_HIDDEN_KEY_PREFIX}.${tabId}` as const
}
