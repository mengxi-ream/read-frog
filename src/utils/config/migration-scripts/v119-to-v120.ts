/**
 * Migration script from v119 to v120.
 *
 * Moves saved provider configs off models that were dropped from the built-in
 * model lists, onto that provider's default as of v120:
 * - DeepSeek retired `deepseek-chat` and `deepseek-reasoner` on 2026-07-24.
 * - Jalapeno Cloud delisted `GLM-5.2`, `Hy3` and `Qwen3-Next-80B-A3B-Instruct`.
 *
 * Two shapes are moved:
 * - Custom-model mode is on and `customModel` is a removed id. Ticking "enter
 *   custom model" copies the selected id into `customModel`, so this is the
 *   common shape, and requests go to `customModel`, so leaving it would keep
 *   calling the dead model. The provider goes back onto the selector with the
 *   replacement (`isCustomModel: false`, `customModel: null`), as v090-to-v091
 *   did for Cohere.
 * - Otherwise, `model.model` is a removed id. Only that field is rewritten,
 *   whatever `isCustomModel` says, because the schema validates it against the
 *   model list even when a custom model is in use. A custom model the user
 *   typed that is not a removed id is kept: it may be a private deployment.
 *
 * A config with nothing to move (including a second run) is returned by
 * identity. Malformed shapes are left for the schema parse that follows.
 *
 * IMPORTANT: This is a frozen snapshot. All model ids are hardcoded inline;
 * it imports nothing from the evolving application code.
 */

const REMOVED_MODELS: Record<string, { removed: readonly string[]; replacement: string }> = {
  deepseek: {
    removed: ["deepseek-chat", "deepseek-reasoner"],
    replacement: "deepseek-v4-flash",
  },
  jalapenocloud: {
    removed: ["GLM-5.2", "Hy3", "Qwen3-Next-80B-A3B-Instruct"],
    replacement: "GLM-5.3",
  },
}

function isObject(value: unknown): value is Record<string, any> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

// `customModel` is free text, so match it the way a user may have typed it.
function isRemovedCustomModel(removed: readonly string[], value: unknown): boolean {
  if (typeof value !== "string") {
    return false
  }
  const id = value.trim().toLowerCase()
  return id !== "" && removed.some((model) => model.toLowerCase() === id)
}

function migrateProvider(provider: unknown): unknown {
  if (
    !isObject(provider) ||
    typeof provider.provider !== "string" ||
    !Object.hasOwn(REMOVED_MODELS, provider.provider) ||
    !isObject(provider.model)
  ) {
    return provider
  }

  const { removed, replacement } = REMOVED_MODELS[provider.provider]!
  const model = provider.model

  if (model.isCustomModel === true && isRemovedCustomModel(removed, model.customModel)) {
    return {
      ...provider,
      model: { ...model, model: replacement, isCustomModel: false, customModel: null },
    }
  }

  if (typeof model.model === "string" && removed.includes(model.model)) {
    return { ...provider, model: { ...model, model: replacement } }
  }

  return provider
}

export function migrate(oldConfig: any): any {
  if (!isObject(oldConfig) || !Array.isArray(oldConfig.providersConfig)) {
    return oldConfig
  }

  const providersConfig = oldConfig.providersConfig.map(migrateProvider)
  if (providersConfig.every((provider, index) => provider === oldConfig.providersConfig[index])) {
    return oldConfig
  }

  return { ...oldConfig, providersConfig }
}
