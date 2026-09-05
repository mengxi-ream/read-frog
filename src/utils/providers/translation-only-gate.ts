import type { Config } from "@/types/config/config"
import type { AllProviderTypes } from "@/types/config/provider"
import { resolveProviderConfigOrNull } from "@/utils/constants/feature-providers"
import { PROVIDER_ITEMS } from "@/utils/constants/providers"
import { i18n } from "@/utils/i18n"

/**
 * Providers whose translate endpoint has no markup-preserving mode. translationOnly
 * page mode re-renders provider output via innerHTML, so the pairing would corrupt
 * pages (Microsoft's unauthenticated endpoint eats tags and translates attribute
 * names — see api/microsoft.ts). The combination is blocked from forming instead:
 * provider pickers hide these while translationOnly is active, mode controls refuse
 * to enter translationOnly while one is active, and migration v093 rewrites configs
 * that already contain the pairing.
 *
 * This list is the whole knob. Every mode control renders its reason through
 * `getTranslationOnlyBlockedReason`, which names the provider from PROVIDER_ITEMS,
 * so adding one here needs no UI change and no new copy.
 */
const PROVIDERS_WITHOUT_MARKUP_SUPPORT: readonly AllProviderTypes[] = ["microsoft-translate"]

const providersWithoutMarkupSupport: ReadonlySet<string> = new Set(PROVIDERS_WITHOUT_MARKUP_SUPPORT)

export function providerSupportsTranslationOnlyMode(provider: string): boolean {
  return !providersWithoutMarkupSupport.has(provider)
}

/**
 * The localized reason the page-translate feature cannot enter translationOnly mode,
 * or null when it can. Shared by every mode control so the wording — and the provider
 * it names — stays in one place.
 */
export function getTranslationOnlyBlockedReason(config: Config): string | null {
  const providerConfig = resolveProviderConfigOrNull(config, "pageTranslation")
  if (!providerConfig || providerSupportsTranslationOnlyMode(providerConfig.provider)) {
    return null
  }
  return i18n.t("options.translation.preference.translationMode.providerNotSupported", [
    PROVIDER_ITEMS[providerConfig.provider].name,
  ])
}
