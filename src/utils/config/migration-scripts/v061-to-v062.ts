/**
 * Migration script from v061 to v062
 * - Unifies language detection config from 3 separate fields into one:
 *   - translate.page.enableLLMDetection (boolean)
 *   - translate.page.enableSkipLanguagesLLMDetection (boolean)
 *   - tts.detectLanguageMode ("basic" | "llm")
 * - Creates new root-level `languageDetection` config
 * - Removes old fields from translate.page and tts
 *
 * IMPORTANT: All values are hardcoded inline. Migration scripts are frozen
 * snapshots — never import constants or helpers that may change.
 */
export function migrate(oldConfig: any): any {
  const enableLLMDetection = oldConfig?.translate?.page?.enableLLMDetection === true
  const enableSkipLanguagesLLMDetection = oldConfig?.translate?.page?.enableSkipLanguagesLLMDetection === true
  const ttsDetectLanguageMode = oldConfig?.tts?.detectLanguageMode

  const anyLLMEnabled = enableLLMDetection
    || enableSkipLanguagesLLMDetection
    || ttsDetectLanguageMode === "llm"

  // Non-LLM provider types at the time of this migration (frozen snapshot)
  const NON_LLM_PROVIDERS = ["google-translate", "microsoft-translate", "deeplx"]
  const providers = Array.isArray(oldConfig?.providersConfig) ? oldConfig.providersConfig : []

  // Find an enabled LLM provider: prefer translate.providerId if it's enabled LLM,
  // else first enabled LLM provider in the list.
  const translateProviderId = oldConfig?.translate?.providerId
  const translateProvider = providers.find((p: any) => p.id === translateProviderId)
  const translateIsEnabledLLM = translateProvider?.enabled === true
    && !NON_LLM_PROVIDERS.includes(translateProvider.provider)

  const providerId = translateIsEnabledLLM
    ? translateProviderId
    : providers.find((p: any) => p.enabled && !NON_LLM_PROVIDERS.includes(p.provider))?.id

  // Only keep llm mode when an enabled LLM provider is available.
  const mode = anyLLMEnabled && providerId ? "llm" : "basic"

  // Remove old fields from translate.page
  const oldPage = oldConfig?.translate?.page ?? {}
  const {
    enableLLMDetection: _a,
    enableSkipLanguagesLLMDetection: _b,
    ...restPage
  } = oldPage

  // Remove old field from tts
  const oldTts = oldConfig?.tts ?? {}
  const {
    detectLanguageMode: _c,
    ...restTts
  } = oldTts

  return {
    ...oldConfig,
    translate: {
      ...oldConfig?.translate,
      page: restPage,
    },
    languageDetection: {
      mode,
      providerId,
    },
    tts: restTts,
  }
}
