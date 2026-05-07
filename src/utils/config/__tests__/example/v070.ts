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

export const testSeries = Object.fromEntries(
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
