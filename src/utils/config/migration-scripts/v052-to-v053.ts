/**
 * Migration script from v052 to v053
 * Unifies LLM provider model configuration:
 * - before: provider.models.read + provider.models.translate
 * - after:  provider.model
 */
export function migrate(oldConfig: any): any {
  const providersConfig = oldConfig?.providersConfig
  if (!Array.isArray(providersConfig)) {
    return oldConfig
  }

  return {
    ...oldConfig,
    providersConfig: providersConfig.map((provider: any) => {
      if (!provider || typeof provider !== 'object') {
        return provider
      }

      const hasUnifiedModel = provider.model && typeof provider.model === 'object'
      if (hasUnifiedModel) {
        const { models, ...rest } = provider
        return rest
      }

      const translateModel = provider.models?.translate
      if (translateModel) {
        const { models, ...rest } = provider
        return {
          ...rest,
          model: translateModel,
        }
      }

      const { models, ...rest } = provider
      return rest
    }),
  }
}
