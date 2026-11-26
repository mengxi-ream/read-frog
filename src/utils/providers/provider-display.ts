import type { ProviderConfig } from "@/types/config/provider"
import type { Theme } from "@/types/config/theme"
import type { HostedAiModelTier, HostedAiUpgradePlan } from "@/utils/hosted-ai/types"
import { PROVIDER_ITEMS } from "@/utils/constants/providers"

/** One Built-in AI model in a provider menu. */
export interface SystemProviderSelectorItem {
  kind: "system"
  id: string
  logo: (theme: Theme) => string
  name: string
  /** The model's id in the server's catalog. */
  model: string
  /** Who makes the model, for its logo; null or missing when unknown. */
  vendor?: string | null
  /** Unknown for a model no list names, such as a stored one the server dropped. */
  tier?: HostedAiModelTier
  /**
   * False when the server says the model cannot run now, or when the stored
   * model is not in the list at all. Missing while that is unknown.
   */
  available?: boolean
  disabled?: boolean
  /**
   * The cheapest plan this account would need to run the option, shown as a
   * badge. Absent when it can run it already, or a plan would not help.
   */
  upgradeTo?: HostedAiUpgradePlan
}

export type ProviderSelectorOption = ProviderConfig | SystemProviderSelectorItem

export function isSystemProviderSelectorItem(
  provider: ProviderSelectorOption,
): provider is SystemProviderSelectorItem {
  return "kind" in provider && provider.kind === "system"
}

export function getProviderLogo(provider: ProviderSelectorOption, theme: Theme): string {
  return isSystemProviderSelectorItem(provider)
    ? provider.logo(theme)
    : PROVIDER_ITEMS[provider.provider].logo(theme)
}

export function getProviderName(provider: ProviderSelectorOption): string {
  return provider.name
}

export function isProviderSelectorOptionDisabled(provider: ProviderSelectorOption): boolean {
  return isSystemProviderSelectorItem(provider) && provider.disabled === true
}

/**
 * Why a Built-in AI option cannot run, when it cannot: `temporary` when the
 * server lists the model but says it cannot run now, `removed` when the list
 * no longer names it. Null when it can run, or when there is no list to tell.
 */
export type BuiltInAiUnavailability = "temporary" | "removed"

export function getBuiltInAiUnavailability(
  provider: ProviderSelectorOption,
): BuiltInAiUnavailability | null {
  if (!isSystemProviderSelectorItem(provider) || provider.available !== false) {
    return null
  }
  // Only a model the list names has a tier.
  return provider.tier === undefined ? "removed" : "temporary"
}

/**
 * The names of the Built-in AI options this menu can switch to instead of
 * `provider`: listed, able to run, and not locked for this account, in the
 * menu's order.
 */
export function getBuiltInAiAlternativeNames(
  provider: ProviderSelectorOption,
  providers: readonly ProviderSelectorOption[],
): string[] {
  return providers
    .filter(
      (other) =>
        other.id !== provider.id &&
        isSystemProviderSelectorItem(other) &&
        other.available === true &&
        other.disabled !== true,
    )
    .map(getProviderName)
}
