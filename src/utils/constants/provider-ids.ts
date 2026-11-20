/**
 * Every Built-in AI model is a provider of its own: this prefix and the model's
 * id in the server's catalog (`hostedAi.status.models`). The server decides
 * which models exist, so the extension never lists them; it only reads them
 * out of the provider ids it stores.
 */
export const BUILT_IN_AI_PROVIDER_ID_PREFIX = "read-frog-ai:"

/**
 * The model a fresh install runs on, and the one the v127 migration moves both
 * old Built-in AI tiers to: it is what both tiers ran on before models could be
 * chosen. A default choice, not the catalog: when the server stops offering it,
 * it shows as unavailable like any other model.
 */
export const DEFAULT_BUILT_IN_AI_MODEL_ID = "gpt-6-luna"

export type BuiltInAiProviderId = `${typeof BUILT_IN_AI_PROVIDER_ID_PREFIX}${string}`

export const DEFAULT_BUILT_IN_AI_PROVIDER_ID: BuiltInAiProviderId = `${BUILT_IN_AI_PROVIDER_ID_PREFIX}${DEFAULT_BUILT_IN_AI_MODEL_ID}`

/**
 * Built-in AI's ids from before each model was a provider of its own, one per
 * tier, and the provider each now reads as: the model the v127 migration moves
 * it to. Configs keep holding them until that migration runs, so the config
 * schema reads them through this (see `storedProviderIdSchema`).
 */
const LEGACY_BUILT_IN_AI_PROVIDER_IDS: Readonly<Record<string, BuiltInAiProviderId>> = {
  "read-frog-free-ai": DEFAULT_BUILT_IN_AI_PROVIDER_ID,
  "read-frog-advance-ai": DEFAULT_BUILT_IN_AI_PROVIDER_ID,
}

/** The provider a stored id names now: a legacy tier id as its model, any other id as is. */
export function resolveLegacyProviderId(providerId: string): string {
  return Object.hasOwn(LEGACY_BUILT_IN_AI_PROVIDER_IDS, providerId)
    ? LEGACY_BUILT_IN_AI_PROVIDER_IDS[providerId]!
    : providerId
}

/** The contract's `HostedAiModelIdSchema` limit. */
const MAX_MODEL_ID_LENGTH = 64

/**
 * Whether a string can be a model id, by the contract's rule (trimmed, 1 to 64
 * characters). Checked by hand rather than with the contract's zod schema: the
 * config schema imports this module, and content scripts must not pull the
 * contract's runtime code in with it.
 */
export function isBuiltInAiModelId(modelId: string): boolean {
  return modelId.length > 0 && modelId.length <= MAX_MODEL_ID_LENGTH && modelId.trim() === modelId
}

export function getBuiltInAiProviderId(modelId: string): BuiltInAiProviderId {
  return `${BUILT_IN_AI_PROVIDER_ID_PREFIX}${modelId}`
}

/**
 * The model a Built-in AI provider id names, or null for any other id. Stored
 * configs reach this unchecked, so a missing id is null too instead of a throw.
 */
export function getBuiltInAiModelId(providerId: string | null | undefined): string | null {
  if (typeof providerId !== "string" || !providerId.startsWith(BUILT_IN_AI_PROVIDER_ID_PREFIX)) {
    return null
  }
  const modelId = providerId.slice(BUILT_IN_AI_PROVIDER_ID_PREFIX.length)
  return isBuiltInAiModelId(modelId) ? modelId : null
}

export function isBuiltInAiProviderId(
  providerId: string | null | undefined,
): providerId is BuiltInAiProviderId {
  return getBuiltInAiModelId(providerId) !== null
}

// Re-exported from the contract so a tier or a level added server-side surfaces here.
export type { HostedAiModelTier, HostedAiReasoning } from "@read-frog/api-contract"
