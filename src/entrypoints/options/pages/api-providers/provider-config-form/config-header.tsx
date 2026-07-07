import type { APIProviderTypes } from "@/types/config/provider"
import ProviderIcon from "@/components/provider-icon"
import { useTheme } from "@/components/providers/theme-provider"
import { Button } from "@/components/ui/base-ui/button"
import { env } from "@/env"
import { PROVIDER_GROUPS, PROVIDER_ITEMS, SPECIFIC_TUTORIAL_PROVIDER_TYPES } from "@/utils/constants/providers"
import { i18n } from "@/utils/i18n"

export function ConfigHeader({ providerType, apiKey }: { providerType: APIProviderTypes, apiKey?: string }) {
  const tutorialUrl = getHowToConfigureURL(providerType)
  const { theme } = useTheme()
  const providerItem = PROVIDER_ITEMS[providerType]
  const sponsorReferUrl = providerItem.sponsor?.sponsoring ? providerItem.sponsor.referUrl : undefined
  const providerWebsiteUrl = sponsorReferUrl ?? providerItem.website
  const hasAPIKey = typeof apiKey === "string" && apiKey.length > 0
  const shouldShowSponsorCTA = sponsorReferUrl && !hasAPIKey

  return (
    <div className="flex items-start justify-between">
      <a href={providerWebsiteUrl} className="flex items-center gap-2" target="_blank" rel="noreferrer">
        <ProviderIcon
          logo={providerItem.logo(theme)}
          name={providerItem.name}
          size="base"
          className="group hover:cursor-pointer"
          textClassName="font-medium group-hover:text-link"
        />
      </a>
      {shouldShowSponsorCTA
        ? (
            <Button
              variant="brand"
              size="sm"
              render={<a href={sponsorReferUrl} target="_blank" rel="noreferrer" />}
            >
              {i18n.t("options.apiProviders.sponsorCta")}
            </Button>
          )
        : tutorialUrl && (
          <a href={tutorialUrl} className="text-xs text-link hover:opacity-90" target="_blank" rel="noreferrer">
            {i18n.t("options.apiProviders.howToConfigure")}
          </a>
        )}
    </div>
  )
}

function getHowToConfigureURL(providerType: APIProviderTypes): string | undefined {
  if (SPECIFIC_TUTORIAL_PROVIDER_TYPES.includes(providerType as any)) {
    return `${env.WXT_WEBSITE_URL}/docs/providers/${providerType}`
  }
  const groupSlug = getProviderGroupSlug(providerType)
  if (!groupSlug)
    return undefined

  return `${env.WXT_WEBSITE_URL}/docs/providers/${groupSlug}`
}

function getProviderGroupSlug(providerType: APIProviderTypes): string | undefined {
  for (const group of Object.values(PROVIDER_GROUPS)) {
    if ((group.types as readonly APIProviderTypes[]).includes(providerType)) {
      return group.tutorialSlug
    }
  }
  return undefined
}
