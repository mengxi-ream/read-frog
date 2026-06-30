/**
 * Migration script from v082 to v083
 * - Updates old Ollama base URLs that pointed at /api to the Ollama root URL.
 *
 * IMPORTANT: All values are hardcoded inline. Migration scripts are frozen
 * snapshots - never import constants or helpers that may change.
 */

function stripOllamaApiSuffix(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined
  }

  const trimmed = value.trim()
  if (!/\/api\/?$/i.test(trimmed)) {
    return undefined
  }

  return `${trimmed.replace(/\/api\/?$/i, "")}/`
}

function migrateProvider(provider: any): any {
  if (!provider || typeof provider !== "object") {
    return provider
  }

  if (provider.provider !== "ollama") {
    return provider
  }

  const migratedBaseURL = stripOllamaApiSuffix(provider.baseURL)
  if (migratedBaseURL === undefined) {
    return { ...provider }
  }

  return { ...provider, baseURL: migratedBaseURL }
}

export function migrate(oldConfig: any): any {
  if (!oldConfig || typeof oldConfig !== "object") {
    return oldConfig
  }

  if (!Array.isArray(oldConfig.providersConfig)) {
    return oldConfig
  }

  return {
    ...oldConfig,
    providersConfig: oldConfig.providersConfig.map(migrateProvider),
  }
}
