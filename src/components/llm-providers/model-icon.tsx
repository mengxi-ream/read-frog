import type { ComponentProps } from "react"
import type { Theme } from "@/types/config/theme"
import type { ProviderSelectorOption } from "@/utils/providers/provider-display"
import ProviderIcon, { normalizeLogoUrl } from "@/components/provider-icon"
import { PROVIDER_ITEMS } from "@/utils/constants/providers"
import {
  getProviderLogo,
  getProviderName,
  isSystemProviderSelectorItem,
} from "@/utils/providers/provider-display"
import { BUILT_IN_AI_PROVIDER_LOGO } from "@/utils/providers/provider-registry"
import { cn } from "@/utils/styles/utils"

type ModelIconSize = "sm" | "base"

/**
 * The frog that marks a vendor's logo as Read Frog's Built-in AI, sized so its
 * centre sits on the circle's edge the way the 12px badge did before it shrank.
 */
const FROG_BADGE_CLASS: Record<ModelIconSize, string> = {
  sm: "size-2.5",
  base: "size-3",
}

/** The logo of the company that makes a model, or null when the extension has none for it. */
export function getModelVendorLogo(vendor: string | null | undefined, theme: Theme): string | null {
  if (typeof vendor !== "string" || !Object.hasOwn(PROVIDER_ITEMS, vendor)) {
    return null
  }
  return PROVIDER_ITEMS[vendor as keyof typeof PROVIDER_ITEMS].logo(theme)
}

/**
 * A Built-in AI model: its vendor's logo with Read Frog's frog on the corner,
 * so GPT-6 Luna reads as OpenAI's model served by Read Frog rather than as an
 * OpenAI key of the user's own. A model whose vendor is unknown shows the frog
 * alone.
 */
export function ModelIcon({
  vendor,
  theme,
  size = "sm",
  ...props
}: {
  vendor: string | null | undefined
  theme: Theme
  size?: ModelIconSize
} & Pick<ComponentProps<typeof ProviderIcon>, "name" | "className" | "textClassName">) {
  const vendorLogo = getModelVendorLogo(vendor, theme)
  if (!vendorLogo) {
    return <ProviderIcon logo={BUILT_IN_AI_PROVIDER_LOGO} size={size} {...props} />
  }

  return (
    <ProviderIcon
      logo={vendorLogo}
      size={size}
      badge={
        <img
          src={normalizeLogoUrl(BUILT_IN_AI_PROVIDER_LOGO)}
          alt=""
          aria-hidden
          data-slot="model-icon-badge"
          className={cn("absolute -right-[3px] -bottom-[3px]", FROG_BADGE_CLASS[size])}
        />
      }
      {...props}
    />
  )
}

/** A provider menu option's icon: a Built-in AI model's, or the provider's own logo. */
export function ProviderOptionIcon({
  provider,
  theme,
  size = "sm",
  ...props
}: {
  provider: ProviderSelectorOption
  theme: Theme
  size?: ModelIconSize
} & Pick<ComponentProps<typeof ProviderIcon>, "className" | "textClassName">) {
  if (isSystemProviderSelectorItem(provider)) {
    return (
      <ModelIcon
        vendor={provider.vendor}
        name={getProviderName(provider)}
        theme={theme}
        size={size}
        {...props}
      />
    )
  }

  return (
    <ProviderIcon
      logo={getProviderLogo(provider, theme)}
      name={getProviderName(provider)}
      size={size}
      {...props}
    />
  )
}
