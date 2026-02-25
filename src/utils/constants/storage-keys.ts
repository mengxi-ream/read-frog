export const TRANSLATION_STATE_KEY_PREFIX = "session:translationState" as const

export function getTranslationStateKey(tabId: number): `session:translationState.${number}` {
  return `${TRANSLATION_STATE_KEY_PREFIX}.${tabId}` as const
}
