import type { TestSeriesObject } from "./types"
import { testSeries as v064TestSeries } from "./v064"

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

function resolveAIContentAwareProviderId(config: unknown): string {
  const configRecord = asRecord(config)
  const providers = asRecordArray(configRecord.providersConfig)
  const translate = asRecord(configRecord.translate)
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

function migrateToV065Config(oldConfig: unknown): unknown {
  const oldConfigRecord = asRecord(oldConfig)
  const oldTranslate = asRecord(oldConfigRecord.translate)

  const restTranslate: UnknownRecord = { ...oldTranslate }
  delete restTranslate.enableAIContentAware
  delete restTranslate.aiContentAware

  return {
    ...oldConfigRecord,
    translate: {
      ...restTranslate,
      aiContentAware: {
        enabled: oldTranslate.enableAIContentAware === true,
        providerId: resolveAIContentAwareProviderId(oldConfig),
      },
    },
  }
}

export const testSeries: TestSeriesObject = Object.fromEntries(
  Object.entries(v064TestSeries).map(([seriesId, series]) => {
    return [
      seriesId,
      {
        ...series,
        config: migrateToV065Config(series.config),
      },
    ]
  }),
) as TestSeriesObject
