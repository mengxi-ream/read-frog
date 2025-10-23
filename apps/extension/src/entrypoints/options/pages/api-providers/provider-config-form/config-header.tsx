import type { APIProviderTypes } from '@/types/config/provider'
import { i18n } from '#imports'
import ProviderIcon from '@/components/provider-icon'
import { useTheme } from '@/components/providers/theme-provider'
import { PROVIDER_GROUPS, PROVIDER_ITEMS, SPECIFIC_TUTORIAL_PROVIDER_TYPES } from '@/utils/constants/providers'
import { WEBSITE_URL } from '@/utils/constants/url'

export function ConfigHeader({ providerType }: { providerType: APIProviderTypes }) {
  const tutorialUrl = getHowToConfigureURL(providerType)
  const { theme } = useTheme()

  return (
    <div className="flex items-start justify-between">
      <a href={PROVIDER_ITEMS[providerType].website} className="flex items-center gap-2" target="_blank" rel="noreferrer">
        <ProviderIcon
          logo={PROVIDER_ITEMS[providerType].logo(theme)}
          name={PROVIDER_ITEMS[providerType].name}
          size="base"
          className="group hover:cursor-pointer"
          textClassName="font-medium group-hover:text-link"
        />
      </a>
      {tutorialUrl && (
        <a href={tutorialUrl} className="text-xs text-link hover:opacity-90" target="_blank" rel="noreferrer">
          {i18n.t('options.apiProviders.howToConfigure')}
        </a>
      )}
    </div>
  )
}

function getHowToConfigureURL(providerType: APIProviderTypes): string | undefined {
  if (SPECIFIC_TUTORIAL_PROVIDER_TYPES.includes(providerType as any)) {
    return `${WEBSITE_URL}/tutorial/providers/${providerType}`
  }
  const groupSlug = getProviderGroupSlug(providerType)
  if (!groupSlug)
    return undefined

  return `${WEBSITE_URL}/tutorial/providers/${groupSlug}`
}

function getProviderGroupSlug(providerType: APIProviderTypes): string | undefined {
  for (const group of Object.values(PROVIDER_GROUPS)) {
    if ((group.types as readonly APIProviderTypes[]).includes(providerType)) {
      return group.tutorialSlug
    }
  }
  return undefined
}
