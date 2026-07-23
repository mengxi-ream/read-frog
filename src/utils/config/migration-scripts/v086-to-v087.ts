/**
 * Migration script from v086 to v087
 * - Drops stale auto-recommended Gemini thinkingConfig provider options from
 *   Google providers. The old recommendations pinned `thinkingBudget`/`thinkingLevel`
 *   values that current Gemini models reject with INVALID_ARGUMENT (Gemini 3.x
 *   rejects `thinkingBudget`, and combining it with `thinkingLevel` is always
 *   rejected). Affected providers fall back to top-level reasoning ("none" when
 *   unset), which the AI SDK maps to a valid thinking config per model.
 * - Hand-written provider options that do not exactly match an old
 *   recommendation are left untouched.
 *
 * IMPORTANT: All values are hardcoded inline. Migration scripts are frozen
 * snapshots - never import constants or helpers that may change.
 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isStaleRecommendedThinkingConfig(providerOptions: unknown): boolean {
  if (!isRecord(providerOptions) || Object.keys(providerOptions).length !== 1) {
    return false
  }

  const thinkingConfig = providerOptions.thinkingConfig
  if (!isRecord(thinkingConfig) || Object.keys(thinkingConfig).length !== 2) {
    return false
  }

  if (thinkingConfig.includeThoughts !== false) {
    return false
  }

  return thinkingConfig.thinkingBudget === 0 || thinkingConfig.thinkingLevel === "minimal"
}

function migrateProvider(provider: any): any {
  if (!isRecord(provider) || provider.provider !== "google") {
    return provider
  }

  if (!isStaleRecommendedThinkingConfig(provider.providerOptions)) {
    return provider
  }

  const { providerOptions: _providerOptions, ...rest } = provider
  return {
    ...rest,
    reasoning: provider.reasoning ?? "none",
  }
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
