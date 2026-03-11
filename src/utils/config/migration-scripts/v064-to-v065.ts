/**
 * Migration script from v064 to v065
 * - Replaces `translate.enableAIContentAware` with `translate.aiContentAware`
 * - Initializes `translate.aiContentAware.providerId`
 *
 * Provider selection strategy:
 * 1) Prefer `translate.providerId` when it points to an enabled LLM provider
 * 2) Otherwise use the first enabled LLM provider from `providersConfig`
 * 3) Fallback to existing translate providerId (or "openai-default") to keep data non-empty
 *
 * IMPORTANT: All values are hardcoded inline. Migration scripts are frozen
 * snapshots — never import constants or helpers that may change.
 */

const NON_LLM_PROVIDERS = ["google-translate", "microsoft-translate", "deeplx"]

type UnknownRecord = Record<string, unknown>

function asRecord(value: unknown): UnknownRecord {
  return value != null && typeof value === "object"
    ? value as UnknownRecord
    : {}
}

function asRecordArray(value: unknown): UnknownRecord[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value
    .filter(item => item != null && typeof item === "object")
    .map(item => item as UnknownRecord)
}

function isEnabledLLMProvider(provider: unknown): provider is UnknownRecord & { id: string } {
  const record = asRecord(provider)
  return record.enabled === true
    && typeof record.provider === "string"
    && !NON_LLM_PROVIDERS.includes(record.provider)
    && typeof record.id === "string"
    && record.id.length > 0
}

function resolveAIContentAwareProviderId(oldConfig: unknown): string {
  const config = asRecord(oldConfig)
  const providers = asRecordArray(config.providersConfig)
  const translate = asRecord(config.translate)
  const translateProviderId = typeof translate.providerId === "string" && translate.providerId.length > 0
    ? translate.providerId
    : undefined

  const translateProvider = providers.find(provider => provider.id === translateProviderId)
  if (isEnabledLLMProvider(translateProvider) && translateProviderId) {
    return translateProviderId
  }

  const fallbackProvider = providers.find(provider => isEnabledLLMProvider(provider))
  if (fallbackProvider && typeof fallbackProvider.id === "string") {
    return fallbackProvider.id
  }

  if (translateProviderId) {
    return translateProviderId
  }

  return "openai-default"
}

export function migrate(oldConfig: unknown): unknown {
  const config = asRecord(oldConfig)
  const oldTranslate = asRecord(config.translate)
  const oldAIContentAware = asRecord(oldTranslate.aiContentAware)

  const restTranslate: UnknownRecord = { ...oldTranslate }
  delete restTranslate.enableAIContentAware
  delete restTranslate.aiContentAware

  const enabled = oldAIContentAware.enabled === true || oldTranslate.enableAIContentAware === true
  const providerId = typeof oldAIContentAware.providerId === "string" && oldAIContentAware.providerId.length > 0
    ? oldAIContentAware.providerId
    : resolveAIContentAwareProviderId(oldConfig)

  return {
    ...config,
    translate: {
      ...restTranslate,
      aiContentAware: {
        enabled,
        providerId,
      },
    },
  }
}
