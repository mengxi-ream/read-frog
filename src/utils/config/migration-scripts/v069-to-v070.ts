/**
 * Migration script from v069 to v070
 * - Renames provider `connectionOptions` to provider-specific settings.
 * - Moves Amazon Bedrock `connectionOptions.region` to `providerSpecificSettings.region`.
 *
 * IMPORTANT: All values are hardcoded inline. Migration scripts are frozen
 * snapshots — never import constants or helpers that may change.
 */

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

export function migrate(oldConfig: any): any {
  if (!Array.isArray(oldConfig?.providersConfig)) {
    return oldConfig
  }

  return {
    ...oldConfig,
    providersConfig: oldConfig.providersConfig.map(migrateProvider),
  }
}
