import type { VersionTestData } from "./types"
import { testSeries as v069TestSeries } from "./v069"

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function normalizeRegion(value: unknown): string {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : "us-east-1"
}

function migrateProvider(provider: any): any {
  if (!isRecord(provider)) {
    return provider
  }

  const {
    connectionOptions,
    providerSpecificSettings,
    ...providerWithoutLegacySettings
  } = provider

  if (provider.provider !== "bedrock") {
    return providerWithoutLegacySettings
  }

  const connectionRegion = isRecord(connectionOptions)
    ? connectionOptions.region
    : undefined
  const existingRegion = isRecord(providerSpecificSettings)
    ? providerSpecificSettings.region
    : undefined

  return {
    ...providerWithoutLegacySettings,
    providerSpecificSettings: {
      region: normalizeRegion(existingRegion ?? connectionRegion),
    },
  }
}

const migratedSeries = Object.fromEntries(
  Object.entries(v069TestSeries).map(([seriesId, seriesData]) => [
    seriesId,
    {
      ...seriesData,
      config: {
        ...seriesData.config,
        providersConfig: Array.isArray(seriesData.config.providersConfig)
          ? seriesData.config.providersConfig.map(migrateProvider)
          : seriesData.config.providersConfig,
      },
    },
  ]),
) as VersionTestData["testSeries"]

const baseDeprecatedDocsDrivenSeries = migratedSeries["complex-config-from-v020"]

export const testSeries = {
  ...migratedSeries,
  "deprecated-docs-driven-provider-models": {
    description: "Deprecated docs-driven provider model ids remain selector-backed before v071 migration",
    config: {
      ...baseDeprecatedDocsDrivenSeries.config,
      providersConfig: [
        ...baseDeprecatedDocsDrivenSeries.config.providersConfig.map((providerConfig: typeof baseDeprecatedDocsDrivenSeries.config.providersConfig[number]) => providerConfig.id === "google-default"
          ? {
              ...providerConfig,
              model: {
                model: "gemini-1.5-flash",
                isCustomModel: false,
                customModel: "",
              },
            }
          : providerConfig.id === "deepseek-default"
            ? {
                ...providerConfig,
                model: {
                  model: "deepseek-v4-flash",
                  isCustomModel: false,
                  customModel: "",
                },
              }
            : providerConfig),
        {
          id: "anthropic-default",
          enabled: true,
          name: "Anthropic",
          provider: "anthropic",
          apiKey: "anth-key",
          model: {
            model: "claude-3-5-haiku-latest",
            isCustomModel: false,
            customModel: "",
          },
        },
        {
          id: "xai-default",
          enabled: true,
          name: "Grok",
          provider: "xai",
          apiKey: "xai-key",
          model: {
            model: "grok-2",
            isCustomModel: false,
            customModel: "",
          },
        },
        {
          id: "bedrock-default",
          enabled: true,
          name: "Amazon Bedrock",
          provider: "bedrock",
          model: {
            model: "us.anthropic.claude-3-7-sonnet-20250219-v1:0",
            isCustomModel: false,
            customModel: "",
          },
          providerSpecificSettings: {
            region: "us-east-1",
          },
        },
        {
          id: "groq-default",
          enabled: true,
          name: "Groq",
          provider: "groq",
          apiKey: "groq-key",
          model: {
            model: "llama-guard-3-8b",
            isCustomModel: false,
            customModel: "",
          },
        },
      ],
    },
  },
} as VersionTestData["testSeries"]
