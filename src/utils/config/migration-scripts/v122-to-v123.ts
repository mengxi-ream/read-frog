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

  return {
    ...oldConfig,
    providersConfig: [...providersConfig, structuredClone(IFAPI_PROVIDER)],
  }
}
