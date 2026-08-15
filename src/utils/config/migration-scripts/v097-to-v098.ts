/**
 * Migration script from v097 to v098.
 *
 * Gives every existing profile the Jalapeno Cloud provider. v098 ships it in the default
 * provider list, but that list only seeds a fresh install — without this step it would reach
 * new users only, and the sponsor's offer is meant for everyone.
 *
 * Nothing here touches headers. v098 also moves OpenRouter's and Anthropic's headers from
 * config-time defaults to forced headers applied at request time, and forced headers need no
 * backfill by design: they are read from code on every call, for existing profiles and new
 * ones alike.
 *
 * Inserted at the head of the list rather than appended, so the sponsor's offer is the first
 * card an existing user sees instead of being buried under whatever providers they already had.
 *
 * Idempotent, and deliberately conservative about what counts as "already there": a profile
 * holding any `jalapenocloud` provider — by the seeded id or by type — is left alone, so
 * re-running the step never produces a second card.
 *
 * DeepSeek leaves the default list in the same release, but only for fresh installs: removing
 * a provider an existing user may have keyed and assigned to a feature would break their
 * setup, so nothing here touches it.
 *
 * IMPORTANT: This is a frozen snapshot. All values and helpers are deliberately inline and it
 * imports nothing from the evolving application code.
 */

const JALAPENO_PROVIDER_TYPE = "jalapenocloud"

// The provider as it stands in v098's defaults, copied out rather than referenced.
const JALAPENO_PROVIDER = {
  id: "jalapenocloud-default",
  name: "Jalapeno Cloud",
  enabled: true,
  provider: JALAPENO_PROVIDER_TYPE,
  baseURL: "https://api.jalapeno-cloud.ai/v1",
  model: {
    model: "DeepSeek-V4-Flash",
    isCustomModel: false,
    customModel: null,
  },
  providerOptions: {
    chat_template_kwargs: {
      thinking: false,
    },
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
      (provider.provider === JALAPENO_PROVIDER_TYPE || provider.id === JALAPENO_PROVIDER.id),
  )
  if (alreadyPresent) {
    return oldConfig
  }

  return {
    ...oldConfig,
    providersConfig: [structuredClone(JALAPENO_PROVIDER), ...providersConfig],
  }
}
