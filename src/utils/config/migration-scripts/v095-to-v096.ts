/**
 * Migration script from v095 to v096.
 *
 * Renames `selectionToolbar.saveSuggestion` to `selectionToolbar.noteSuggestion`
 * so the config matches the feature's name everywhere else (the hosted AI
 * contract, the feature key, and the UI all say "note suggestion"), and gives
 * it its own provider in the same step.
 *
 * Until now the suggestion borrowed the selection-translate provider at run
 * time, so the seed copies that provider when it is an enabled LLM provider —
 * preserving today's effective behavior — and otherwise falls back to the
 * hosted Advanced Built-in AI provider, which is guaranteed to exist and to
 * support the feature (accounts without Ultra access simply skip suggestions
 * via the hosted status gate until they upgrade or pick another provider).
 *
 * IMPORTANT: This is a frozen snapshot. All values and helpers are deliberately inline and it
 * imports nothing from the evolving application code.
 */

const BUILT_IN_AI_ULTRA_PROVIDER_ID = "read-frog-ultra-ai"

// LLM_PROVIDER_TYPES as of v095, frozen.
const LLM_PROVIDER_TYPES = [
  "openai",
  "deepseek",
  "google",
  "anthropic",
  "xai",
  "openai-compatible",
  "open-responses",
  "atlascloud",
  "openrouter",
  "minimax",
  "siliconflow",
  "tensdaq",
  "azure",
  "bedrock",
  "groq",
  "deepinfra",
  "mistral",
  "togetherai",
  "cohere",
  "fireworks",
  "cerebras",
  "replicate",
  "perplexity",
  "vercel",
  "ollama",
  "volcengine",
  "alibaba",
  "moonshotai",
  "huggingface",
]

function isObject(value: any): value is Record<string, any> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

export function migrate(oldConfig: any): any {
  if (!isObject(oldConfig)) return oldConfig

  const selectionToolbar = oldConfig.selectionToolbar
  if (!isObject(selectionToolbar)) return oldConfig

  const { saveSuggestion, ...restSelectionToolbar } = selectionToolbar
  // A config that already carries the new key keeps it: the old section is
  // stale in that case, so dropping it is the correct merge.
  const alreadyMigrated = isObject(restSelectionToolbar.noteSuggestion)
  const existing = alreadyMigrated ? restSelectionToolbar.noteSuggestion : saveSuggestion
  if (!isObject(existing)) return oldConfig

  // Nothing left to do: the section already lives under the new key, carries a
  // provider, and no stale old key remains.
  if (
    alreadyMigrated &&
    !("saveSuggestion" in selectionToolbar) &&
    typeof existing.providerId === "string" &&
    existing.providerId !== ""
  ) {
    return oldConfig
  }

  const translateProviderId = selectionToolbar.features?.translate?.providerId
  const providersConfig = oldConfig.providersConfig
  const translateProvider = Array.isArray(providersConfig)
    ? providersConfig.find(
        (provider: any) => isObject(provider) && provider.id === translateProviderId,
      )
    : undefined
  const isEnabledLLMProvider =
    isObject(translateProvider) &&
    translateProvider.enabled === true &&
    LLM_PROVIDER_TYPES.includes(translateProvider.provider)
  const providerId =
    typeof existing.providerId === "string" && existing.providerId !== ""
      ? existing.providerId
      : isEnabledLLMProvider
        ? translateProviderId
        : BUILT_IN_AI_ULTRA_PROVIDER_ID

  return {
    ...oldConfig,
    selectionToolbar: {
      ...restSelectionToolbar,
      noteSuggestion: {
        ...existing,
        providerId,
      },
    },
  }
}
