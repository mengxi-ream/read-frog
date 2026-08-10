import type { Config } from "@/types/config/config"
import { resolveProviderConfigOrNull } from "@/utils/constants/feature-providers"

/**
 * Microsoft's unauthenticated translate endpoint has no markup-preserving
 * mode, and translationOnly page mode re-renders provider output via
 * innerHTML, so the pairing would corrupt pages (see api/microsoft.ts). The
 * combination is blocked from forming instead: provider pickers hide
 * Microsoft while translationOnly is active, mode controls refuse to enter
 * translationOnly while Microsoft is active, and migration v093 rewrites
 * configs that already contain the pairing.
 */
export function providerSupportsTranslationOnlyMode(provider: string): boolean {
  return provider !== "microsoft-translate"
}

/** Whether the page-translate feature's current provider allows entering translationOnly mode. */
export function canEnterTranslationOnlyMode(config: Config): boolean {
  const providerConfig = resolveProviderConfigOrNull(config, "pageTranslation")
  return providerConfig === null || providerSupportsTranslationOnlyMode(providerConfig.provider)
}
