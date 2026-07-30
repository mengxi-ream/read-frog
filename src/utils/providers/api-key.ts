import type { APIProviderTypes } from "@/types/config/provider"

const API_KEY_OPTIONAL_PROVIDER_TYPES = new Set<APIProviderTypes>([
  "deeplx",
  "ollama",
  "openai-codex",
])

export function providerRequiresApiKey(provider: APIProviderTypes): boolean {
  return !API_KEY_OPTIONAL_PROVIDER_TYPES.has(provider)
}
