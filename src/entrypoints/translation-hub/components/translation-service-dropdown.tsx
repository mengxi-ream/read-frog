import { browser, i18n } from '#imports'
import { IconSettings } from '@tabler/icons-react'
import { useAtom, useAtomValue } from 'jotai'
import { Button } from '@/components/base-ui/button'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/base-ui/select'
import ProviderIcon from '@/components/provider-icon'
import { useTheme } from '@/components/providers/theme-provider'
import { configFieldsAtomMap } from '@/utils/atoms/config'
import { filterEnabledProvidersConfig, getLLMTranslateProvidersConfig, getNonAPIProvidersConfig, getPureAPIProvidersConfig, getTranslateProvidersConfig } from '@/utils/config/helpers'
import { PROVIDER_ITEMS } from '@/utils/constants/providers'
import { selectedProviderIdsAtom } from '../atoms'

export function TranslationServiceDropdown() {
  const { theme = 'light' } = useTheme()
  const [selectedIds, setSelectedIds] = useAtom(selectedProviderIdsAtom)
  const providersConfig = useAtomValue(configFieldsAtomMap.providersConfig)
  const translateProviders = getTranslateProvidersConfig(providersConfig)
  const filteredProvidersConfig = filterEnabledProvidersConfig(translateProviders)

  const handleConfigureAPI = async () => {
    try {
      await browser.tabs.create({
        url: browser.runtime.getURL('/options.html#/api-providers'),
      })
    }
    catch (error) {
      console.error('Error opening configure API:', error)
    }
  }

  const aiProviders = getLLMTranslateProvidersConfig(filteredProvidersConfig)
  const nonAPIProviders = getNonAPIProvidersConfig(filteredProvidersConfig)
  const pureAPIProviders = getPureAPIProvidersConfig(filteredProvidersConfig)

  return (
    <div className="flex items-center gap-2">
      <Select
        multiple
        value={selectedIds}
        onValueChange={setSelectedIds}
      >
        <SelectTrigger className="min-w-52">
          <SelectValue placeholder={i18n.t('translateService.selectServices')}>
            {selectedIds.length > 0
              ? (
                  <div className="flex items-center gap-2">
                    <span>{i18n.t('translateService.translationProviders')}</span>
                    <span className="text-xs bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full">
                      {selectedIds.length}
                    </span>
                  </div>
                )
              : (
                  <span className="text-muted-foreground">{i18n.t('translateService.selectServices')}</span>
                )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {aiProviders.length > 0 && (
            <SelectGroup>
              <SelectLabel>{i18n.t('translateService.aiTranslator')}</SelectLabel>
              {aiProviders.map(({ id, name, provider }) => (
                <SelectItem key={id} value={id}>
                  <ProviderIcon logo={PROVIDER_ITEMS[provider].logo(theme)} name={name} size="sm" />
                </SelectItem>
              ))}
            </SelectGroup>
          )}
          {(nonAPIProviders.length > 0 || pureAPIProviders.length > 0) && (
            <SelectGroup>
              <SelectLabel>{i18n.t('translateService.normalTranslator')}</SelectLabel>
              {nonAPIProviders.map(({ id, name, provider }) => (
                <SelectItem key={id} value={id}>
                  <ProviderIcon logo={PROVIDER_ITEMS[provider].logo(theme)} name={name} size="sm" />
                </SelectItem>
              ))}
              {pureAPIProviders.map(({ id, name, provider }) => (
                <SelectItem key={id} value={id}>
                  <ProviderIcon logo={PROVIDER_ITEMS[provider].logo(theme)} name={name} size="sm" />
                </SelectItem>
              ))}
            </SelectGroup>
          )}
        </SelectContent>
      </Select>

      <Button variant="outline" size="icon" onClick={handleConfigureAPI} title={i18n.t('translateService.configureAPI')}>
        <IconSettings />
      </Button>
    </div>
  )
}
