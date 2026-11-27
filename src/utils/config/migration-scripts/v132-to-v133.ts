/**
 * Migration script from v132 to v133.
 *
 * Moves saved provider configs off models that were dropped from the built-in
 * model lists because the provider shuts them down by 2026-12-01 or has
 * already retired them, onto the replacement the provider recommends:
 * - Google: gemini-2.5-pro and gemini-2.5-flash. Google stops serving both on
 *   2026-12-01 and routes the old ids to gemini-3.8-flash and
 *   gemini-3.5-flash-lite (billed at their rates, with breaking API changes),
 *   so the ids are moved to those models now.
 *   gemini-2.5-flash-lite is not deprecated and is kept.
 *   https://ai.google.dev/gemini-api/docs/deprecations
 * - DeepSeek: deepseek-v4-flash. V4 Flash is retired and the name only
 *   temporarily routes to V4.1 Flash, which deepseek-flash serves.
 *   v128-to-v129 kept the id listed (it was the default and a UI context can
 *   read a not-yet-migrated config), so it could be picked again afterwards.
 *   https://api-docs.deepseek.com/updates
 *
 * Two shapes are moved, as in v128-to-v129:
 * - Custom-model mode is on and `customModel` is a removed id. Ticking "enter
 *   custom model" copies the selected id into `customModel`, and requests go
 *   to `customModel`, so leaving it would keep calling the dead model. The
 *   provider goes back onto the selector with the replacement
 *   (`isCustomModel: false`, `customModel: null`).
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

const REPLACEMENTS: Record<string, Readonly<Record<string, string>>> = {
  google: {
    "gemini-2.5-pro": "gemini-3.8-flash",
    "gemini-2.5-flash": "gemini-3.5-flash-lite",
  },
  deepseek: {
    "deepseek-v4-flash": "deepseek-flash",
  },
}

function isObject(value: unknown): value is Record<string, any> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function replacementFor(replacements: Readonly<Record<string, string>>, id: string) {
  return Object.hasOwn(replacements, id) ? replacements[id] : undefined
}

// `customModel` is free text, so match it the way a user may have typed it.
function customModelReplacement(
  replacements: Readonly<Record<string, string>>,
  value: unknown,
): string | undefined {
  if (typeof value !== "string") {
    return undefined
  }
  const id = value.trim().toLowerCase()
  if (id === "") {
    return undefined
  }
  const removed = Object.keys(replacements).find((model) => model.toLowerCase() === id)
  return removed === undefined ? undefined : replacements[removed]
}

function migrateProvider(provider: unknown): unknown {
  if (
    !isObject(provider) ||
    typeof provider.provider !== "string" ||
    !Object.hasOwn(REPLACEMENTS, provider.provider) ||
    !isObject(provider.model)
  ) {
    return provider
  }

  const replacements = REPLACEMENTS[provider.provider]!
  const model = provider.model

  if (model.isCustomModel === true) {
    const replacement = customModelReplacement(replacements, model.customModel)
    if (replacement !== undefined) {
      return {
        ...provider,
        model: { ...model, model: replacement, isCustomModel: false, customModel: null },
      }
    }
  }

  const replacement =
    typeof model.model === "string" ? replacementFor(replacements, model.model) : undefined
  if (replacement !== undefined) {
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
