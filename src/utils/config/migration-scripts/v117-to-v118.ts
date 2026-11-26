/**
 * Migration script from v117 to v118.
 *
 * Moves AI actions whose provider has no API key onto the Built-in AI. Such an
 * action could only ever fail with the AI SDK's "API key is missing" error;
 * these are mostly actions saved before new actions started on the Built-in AI,
 * pointing at a default provider whose key was never filled in.
 *
 * Covers the built-in actions (`selectionToolbar.builtInActions.*.providerId`)
 * and the custom ones (`selectionToolbar.customActions[].providerId`). An
 * action moves only when its provider:
 * - is in `providersConfig`, and
 * - is a type that cannot run without a key (hosted LLM APIs), and
 * - has no key (missing, or only whitespace).
 *
 * Left alone: Ollama and the custom OpenAI-compatible / Open Responses types,
 * which often point at a local server that needs no key; providers that are
 * not in `providersConfig`; and anything that is not an AI action.
 *
 * A config with nothing to move (including a second run) is returned by
 * identity. Malformed shapes are left for the schema parse that follows.
 *
 * IMPORTANT: This is a frozen snapshot. All ids and provider types are
 * hardcoded inline; it imports nothing from the evolving application code.
 */

const BUILT_IN_AI_PROVIDER_ID = "read-frog-free-ai"

// Provider types that cannot answer without an API key, as of v118.
const KEY_REQUIRED_PROVIDER_TYPES = new Set([
  "openai",
  "deepseek",
  "google",
  "anthropic",
  "xai",
  "jalapenocloud",
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
  "volcengine",
  "alibaba",
  "moonshotai",
  "huggingface",
])

function isObject(value: any): value is Record<string, any> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function getKeylessProviderIds(providersConfig: unknown): Set<string> {
  const ids = new Set<string>()
  if (!Array.isArray(providersConfig)) {
    return ids
  }

  for (const provider of providersConfig) {
    if (
      isObject(provider) &&
      typeof provider.id === "string" &&
      KEY_REQUIRED_PROVIDER_TYPES.has(provider.provider) &&
      (typeof provider.apiKey !== "string" || provider.apiKey.trim() === "")
    ) {
      ids.add(provider.id)
    }
  }
  return ids
}

export function migrate(oldConfig: any): any {
  if (!isObject(oldConfig)) {
    return oldConfig
  }

  const selectionToolbar = oldConfig.selectionToolbar
  if (!isObject(selectionToolbar)) {
    return oldConfig
  }

  const keylessProviderIds = getKeylessProviderIds(oldConfig.providersConfig)
  if (keylessProviderIds.size === 0) {
    return oldConfig
  }

  const needsMove = (action: unknown): action is Record<string, any> =>
    isObject(action) &&
    typeof action.providerId === "string" &&
    keylessProviderIds.has(action.providerId)

  const moveToBuiltInAi = (action: unknown) =>
    needsMove(action) ? { ...action, providerId: BUILT_IN_AI_PROVIDER_ID } : action

  const nextSelectionToolbar: Record<string, any> = { ...selectionToolbar }
  let changed = false

  const builtInActions = selectionToolbar.builtInActions
  if (isObject(builtInActions) && Object.values(builtInActions).some(needsMove)) {
    nextSelectionToolbar.builtInActions = Object.fromEntries(
      Object.entries(builtInActions).map(([id, action]) => [id, moveToBuiltInAi(action)]),
    )
    changed = true
  }

  const customActions = selectionToolbar.customActions
  if (Array.isArray(customActions) && customActions.some(needsMove)) {
    nextSelectionToolbar.customActions = customActions.map(moveToBuiltInAi)
    changed = true
  }

  if (!changed) {
    return oldConfig
  }

  return { ...oldConfig, selectionToolbar: nextSelectionToolbar }
}
