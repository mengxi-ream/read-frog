/**
 * Migration script from v090 to v091
 * - Cohere retired the original Command family on 2025-09-15, so those ids are gone
 *   from the hardcoded model list and every saved config still holding one has to be
 *   remapped here. `model` is checked against the live enum even while custom-model
 *   mode is on, so a stale selector value is not cosmetic: it fails validation and
 *   `initializeConfig` then rebuilds the whole config from defaults.
 * - `customModel` is free text, so a retired id parked there passes validation and
 *   silently keeps calling a dead endpoint. Ticking "enter custom model" copies the
 *   selected id into `customModel`, which makes that the common shape rather than an
 *   exotic one, so a retired custom value is remapped back onto the selector the same
 *   way v079-to-v080 handled xAI. A custom value that is not a retired id is left
 *   untouched: it may be a private deployment behind a custom baseURL.
 *
 * IMPORTANT: All values are hardcoded inline. Migration scripts are frozen
 * snapshots - never import constants or helpers that may change.
 */

/**
 * Targets follow Cohere's own deprecation notice, which points every retired id at
 * `command-r-08-2024`, `command-r-plus-08-2024` or `command-a-03-2025`. The two
 * `command-r*` families keep their generation; the original `command`/`command-light`
 * line has no like-for-like successor, so it lands on the general-purpose flagship.
 */
const RETIRED_COHERE_MODEL_REPLACEMENTS: Record<string, string> = {
  "command-r": "command-r-08-2024",
  "command-r-03-2024": "command-r-08-2024",
  "command-r-plus": "command-r-plus-08-2024",
  "command-r-plus-04-2024": "command-r-plus-08-2024",
  command: "command-a-03-2025",
  "command-nightly": "command-a-03-2025",
  "command-light": "command-a-03-2025",
  "command-light-nightly": "command-a-03-2025",
}

function getReplacement(value: unknown): string | null {
  if (typeof value !== "string") {
    return null
  }

  const model = value.trim().toLowerCase()
  return model ? (RETIRED_COHERE_MODEL_REPLACEMENTS[model] ?? null) : null
}

function migrateProviderConfig(providerConfig: any): any {
  if (!providerConfig || typeof providerConfig !== "object") {
    return providerConfig
  }

  const modelConfig = providerConfig.model
  if (
    providerConfig.provider !== "cohere" ||
    !modelConfig ||
    typeof modelConfig !== "object" ||
    Array.isArray(modelConfig)
  ) {
    return providerConfig
  }

  const isCustomModel = modelConfig.isCustomModel === true

  // The model requests actually go to is retired: drop back to the selector so the
  // provider points at something that still exists.
  const activeCustomReplacement = isCustomModel ? getReplacement(modelConfig.customModel) : null
  if (activeCustomReplacement !== null) {
    return {
      ...providerConfig,
      model: {
        ...modelConfig,
        model: activeCustomReplacement,
        isCustomModel: false,
        customModel: null,
      },
    }
  }

  const selectorReplacement = getReplacement(modelConfig.model)
  if (selectorReplacement === null) {
    return providerConfig
  }

  // A still-usable custom model stays active; only the dormant selector is rewritten
  // so it passes the enum check.
  if (isCustomModel) {
    return {
      ...providerConfig,
      model: {
        ...modelConfig,
        model: selectorReplacement,
      },
    }
  }

  return {
    ...providerConfig,
    model: {
      ...modelConfig,
      model: selectorReplacement,
      isCustomModel: false,
      customModel: null,
    },
  }
}

export function migrate(oldConfig: any): any {
  if (!oldConfig || typeof oldConfig !== "object" || !Array.isArray(oldConfig.providersConfig)) {
    return oldConfig
  }

  return {
    ...oldConfig,
    providersConfig: oldConfig.providersConfig.map(migrateProviderConfig),
  }
}
