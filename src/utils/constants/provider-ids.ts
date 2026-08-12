// Keep the persisted provider ID stable so existing user configurations continue to work.
export const BUILT_IN_AI_PROVIDER_ID = "read-frog-free-ai"
export const BUILT_IN_AI_ADVANCE_PROVIDER_ID = "read-frog-advance-ai"

export const BUILT_IN_AI_PROVIDER_IDS = [
  BUILT_IN_AI_PROVIDER_ID,
  BUILT_IN_AI_ADVANCE_PROVIDER_ID,
] as const

export type BuiltInAiProviderId = (typeof BUILT_IN_AI_PROVIDER_IDS)[number]
// Re-exported from the contract so a tier added server-side surfaces here.
export type { HostedAiModelTier } from "@read-frog/api-contract"
