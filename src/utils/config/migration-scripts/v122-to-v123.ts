/**
 * Migration script from v122 to v123.
 *
 * Gives every existing profile the IF API provider. v123 ships it in the default provider list,
 * but that list only seeds a fresh install — without this step the sponsor's offer would reach
 * new users only.
 *
 * Appended to the end of the list, after whatever the user already has, so their own providers
 * keep their order and the first card they see does not change.
 *
 * The description is written in here, in English, because nothing backfills it afterwards (see
 * v098-to-v099) and a migration cannot reach i18n. It stays editable.
 *
 * Idempotent, and conservative about what counts as "already there": a profile holding any
 * `ifapi` provider — by the seeded id or by type — is left alone, so re-running the step never
 * produces a second card.
 *
 * Provider names must be unique, and a config that fails validation after migrating is replaced
 * with fresh defaults — keys, custom actions and all. Someone who already reached IF API through
 * a custom card they named "IF API" would lose everything, so the seeded card takes the next
 * free name instead ("IF API 1", "IF API 2", …), the way the options page names a copy.
 *
 * IMPORTANT: This is a frozen snapshot. All values and helpers are deliberately inline and it
 * imports nothing from the evolving application code.
 */

const IFAPI_PROVIDER_TYPE = "ifapi"

// The provider as it stands in v123's defaults, copied out rather than referenced.
const IFAPI_PROVIDER = {
  id: "ifapi-default",
  name: "IF API",
  enabled: true,
  provider: IFAPI_PROVIDER_TYPE,
  description: "GPT, Claude, Gemini and more, from 10% of list price",
  baseURL: "https://cn.ifapi.org/v1",
  model: {
    model: "gpt-6-luna",
    isCustomModel: false,
    customModel: null,
  },
  providerOptions: {
    reasoning_effort: "none",
  },
}

function isObject(value: any): value is Record<string, any> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function uniqueName(baseName: string, providersConfig: any[]): string {
  const taken = new Set(providersConfig.filter(isObject).map((provider) => provider.name))
  if (!taken.has(baseName)) return baseName
  for (let i = 1; ; i++) {
    const candidate = `${baseName} ${i}`
    if (!taken.has(candidate)) return candidate
  }
}

export function migrate(oldConfig: any): any {
  if (!isObject(oldConfig) || !Array.isArray(oldConfig.providersConfig)) {
    return oldConfig
  }

  const providersConfig: any[] = oldConfig.providersConfig

  const alreadyPresent = providersConfig.some(
    (provider) =>
      isObject(provider) &&
      (provider.provider === IFAPI_PROVIDER_TYPE || provider.id === IFAPI_PROVIDER.id),
  )
  if (alreadyPresent) {
    return oldConfig
  }

  const seeded = {
    ...structuredClone(IFAPI_PROVIDER),
    name: uniqueName(IFAPI_PROVIDER.name, providersConfig),
  }

  return {
    ...oldConfig,
    providersConfig: [...providersConfig, seeded],
  }
}
