import type { ProviderConfig, ProvidersConfig } from "@/types/config/provider"
import type { GoogleProviderConfig } from "@/types/gemini-tts"

function isGoogleProviderConfig(provider: ProviderConfig): provider is GoogleProviderConfig {
  return provider.provider === "google"
}

/** The Google (Gemini) providers from API Providers that Gemini TTS can take its API key from. */
export function getGeminiTTSProviders(providersConfig: ProvidersConfig): GoogleProviderConfig[] {
  return providersConfig.filter(
    (provider): provider is GoogleProviderConfig =>
      isGoogleProviderConfig(provider) && provider.enabled,
  )
}

export function resolveGeminiTTSProvider(
  providersConfig: ProvidersConfig,
  providerId: string | null,
): GoogleProviderConfig | null {
  if (!providerId) {
    return null
  }
  return (
    getGeminiTTSProviders(providersConfig).find((provider) => provider.id === providerId) ?? null
  )
}
