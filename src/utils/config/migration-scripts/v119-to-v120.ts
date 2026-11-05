/**
 * Migration script from v119 to v120.
 *
 * Moves saved provider configs off models that were dropped from the built-in
 * model lists, onto that provider's default as of v120:
 * - DeepSeek retired `deepseek-chat` and `deepseek-reasoner` on 2026-07-24.
 * - Jalapeno Cloud delisted `GLM-5.2`, `Hy3` and `Qwen3-Next-80B-A3B-Instruct`.
 *
 * Only `providersConfig[].model.model` is rewritten. It is remapped whatever
 * `isCustomModel` says, because the schema validates that field against the
 * model list even when a custom model is in use. `isCustomModel` and
 * `customModel` are kept as they are, so a user typing their own model id
 * keeps it.
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

function needsMove(provider: unknown): provider is Record<string, any> {
  if (!isObject(provider) || typeof provider.provider !== "string") {
    return false
  }
  const entry = REMOVED_MODELS[provider.provider]
  return (
    entry !== undefined &&
    isObject(provider.model) &&
    typeof provider.model.model === "string" &&
    entry.removed.includes(provider.model.model)
  )
}

export function migrate(oldConfig: any): any {
  if (!isObject(oldConfig)) {
    return oldConfig
  }

  const providersConfig = oldConfig.providersConfig
  if (!Array.isArray(providersConfig) || !providersConfig.some(needsMove)) {
    return oldConfig
  }

  return {
    ...oldConfig,
    providersConfig: providersConfig.map((provider) =>
      needsMove(provider)
        ? {
            ...provider,
            model: {
              ...provider.model,
              model: REMOVED_MODELS[provider.provider]!.replacement,
            },
          }
        : provider,
    ),
  }
}
