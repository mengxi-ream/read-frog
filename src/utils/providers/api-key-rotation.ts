import type { APIProviderConfig } from "@/types/config/provider"

export const DEFAULT_API_KEY_ROTATION_MODE = "sequential"
export const DEFAULT_API_KEY_COOLDOWN_SECONDS = 300

export interface APIKeyAttemptContext {
  apiKey?: string
  apiKeyCount: number
  apiKeyIndex: number
}

export interface APIKeyRotationOptions {
  shouldFallback?: (error: Error, context: APIKeyAttemptContext) => boolean
}

interface APIKeyRotationState {
  nextIndex: number
  cooldownUntilByKey: Map<string, number>
}

const rotationStateByProviderId = new Map<string, APIKeyRotationState>()

function getRotationState(providerId: string): APIKeyRotationState {
  const existing = rotationStateByProviderId.get(providerId)
  if (existing)
    return existing

  const state: APIKeyRotationState = {
    nextIndex: 0,
    cooldownUntilByKey: new Map(),
  }
  rotationStateByProviderId.set(providerId, state)
  return state
}

export function parseProviderAPIKeys(apiKey?: string): string[] {
  if (!apiKey)
    return []

  const seen = new Set<string>()
  const keys: string[] = []
  for (const key of apiKey.split(",").map(item => item.trim()).filter(Boolean)) {
    if (seen.has(key))
      continue
    seen.add(key)
    keys.push(key)
  }
  return keys
}

function getRotationMode(providerConfig: APIProviderConfig) {
  return providerConfig.apiKeyRotationMode ?? DEFAULT_API_KEY_ROTATION_MODE
}

function getCooldownMs(providerConfig: APIProviderConfig) {
  return (providerConfig.apiKeyCooldownSeconds ?? DEFAULT_API_KEY_COOLDOWN_SECONDS) * 1000
}

function isCoolingDown(state: APIKeyRotationState, apiKey: string, now: number) {
  const cooldownUntil = state.cooldownUntilByKey.get(apiKey)
  if (!cooldownUntil)
    return false

  if (cooldownUntil <= now) {
    state.cooldownUntilByKey.delete(apiKey)
    return false
  }

  return true
}

function getAvailableIndexes(
  apiKeys: string[],
  state: APIKeyRotationState,
  attemptedIndexes: Set<number>,
  now: number,
) {
  return apiKeys
    .map((apiKey, index) => ({ apiKey, index }))
    .filter(({ apiKey, index }) => !attemptedIndexes.has(index) && !isCoolingDown(state, apiKey, now))
}

function selectSequentialAPIKey(
  apiKeys: string[],
  state: APIKeyRotationState,
  attemptedIndexes: Set<number>,
  now: number,
) {
  const startIndex = state.nextIndex % apiKeys.length
  for (let offset = 0; offset < apiKeys.length; offset++) {
    const index = (startIndex + offset) % apiKeys.length
    const apiKey = apiKeys[index]
    if (attemptedIndexes.has(index) || isCoolingDown(state, apiKey, now))
      continue

    state.nextIndex = (index + 1) % apiKeys.length
    return { apiKey, index }
  }
}

function selectRandomAPIKey(
  apiKeys: string[],
  state: APIKeyRotationState,
  attemptedIndexes: Set<number>,
  now: number,
) {
  const available = getAvailableIndexes(apiKeys, state, attemptedIndexes, now)
  if (available.length === 0)
    return undefined

  return available[Math.floor(Math.random() * available.length)]
}

function selectAPIKey(
  providerConfig: APIProviderConfig,
  apiKeys: string[],
  attemptedIndexes: Set<number>,
  now: number,
) {
  const state = getRotationState(providerConfig.id)
  if (getRotationMode(providerConfig) === "random")
    return selectRandomAPIKey(apiKeys, state, attemptedIndexes, now)

  return selectSequentialAPIKey(apiKeys, state, attemptedIndexes, now)
}

function markAPIKeyCoolingDown(providerConfig: APIProviderConfig, apiKey: string) {
  const cooldownMs = getCooldownMs(providerConfig)
  if (cooldownMs <= 0)
    return

  getRotationState(providerConfig.id).cooldownUntilByKey.set(apiKey, Date.now() + cooldownMs)
}

function buildNoAvailableKeyError(providerConfig: APIProviderConfig, apiKeyCount: number) {
  return new Error(
    `No API key is currently available for "${providerConfig.name}". `
    + `${apiKeyCount} configured API key(s) are cooling down.`,
  )
}

export function getNextProviderAPIKey(providerConfig: APIProviderConfig): string | undefined {
  const apiKeys = parseProviderAPIKeys(providerConfig.apiKey)
  if (apiKeys.length <= 1)
    return apiKeys[0]

  const selected = selectAPIKey(providerConfig, apiKeys, new Set(), Date.now())
  if (!selected)
    throw buildNoAvailableKeyError(providerConfig, apiKeys.length)

  return selected.apiKey
}

export async function withProviderAPIKeyRotation<T>(
  providerConfig: APIProviderConfig,
  operation: (apiKey: string | undefined, context: APIKeyAttemptContext) => Promise<T>,
  options: APIKeyRotationOptions = {},
): Promise<T> {
  const apiKeys = parseProviderAPIKeys(providerConfig.apiKey)

  if (apiKeys.length <= 1) {
    return operation(apiKeys[0], {
      apiKey: apiKeys[0],
      apiKeyCount: apiKeys.length,
      apiKeyIndex: apiKeys.length === 1 ? 0 : -1,
    })
  }

  const attemptedIndexes = new Set<number>()
  const errors: Error[] = []

  while (attemptedIndexes.size < apiKeys.length) {
    const selected = selectAPIKey(providerConfig, apiKeys, attemptedIndexes, Date.now())
    if (!selected)
      break

    attemptedIndexes.add(selected.index)

    try {
      const context: APIKeyAttemptContext = {
        apiKey: selected.apiKey,
        apiKeyCount: apiKeys.length,
        apiKeyIndex: selected.index,
      }
      return await operation(selected.apiKey, context)
    }
    catch (error) {
      const normalizedError = error instanceof Error ? error : new Error(String(error))
      if (options.shouldFallback?.(normalizedError, {
        apiKey: selected.apiKey,
        apiKeyCount: apiKeys.length,
        apiKeyIndex: selected.index,
      }) === false) {
        throw normalizedError
      }

      markAPIKeyCoolingDown(providerConfig, selected.apiKey)
      errors.push(normalizedError)
    }
  }

  const lastError = errors.at(-1)
  if (lastError) {
    throw new Error(
      `All configured API keys failed for "${providerConfig.name}". Last error: ${lastError.message}`,
      { cause: lastError },
    )
  }

  throw buildNoAvailableKeyError(providerConfig, apiKeys.length)
}

export function clearAPIKeyRotationStateForTests() {
  rotationStateByProviderId.clear()
}
