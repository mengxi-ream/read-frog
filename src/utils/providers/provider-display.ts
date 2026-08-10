import type { ProviderConfig } from "@/types/config/provider"
import type { Theme } from "@/types/config/theme"
import { PROVIDER_ITEMS } from "@/utils/constants/providers"

export interface ProviderSelectorItem {
  kind: "system"
  id: string
  logo: (theme: Theme) => string
  name: string
  disabled?: boolean
  /** Marks an option no non-Ultra account can run, shown as an "Ultra" badge. */
  requiresUltra?: boolean
}

export type ProviderSelectorOption = ProviderConfig | ProviderSelectorItem

export function isProviderSelectorItem(
  provider: ProviderSelectorOption,
): provider is ProviderSelectorItem {
  return "kind" in provider && provider.kind === "system"
}

export function getProviderLogo(provider: ProviderSelectorOption, theme: Theme): string {
  return isProviderSelectorItem(provider)
    ? provider.logo(theme)
    : PROVIDER_ITEMS[provider.provider].logo(theme)
}

export function getProviderName(provider: ProviderSelectorOption): string {
  return provider.name
}

export function isProviderSelectorOptionDisabled(provider: ProviderSelectorOption): boolean {
  return isProviderSelectorItem(provider) && provider.disabled === true
}
