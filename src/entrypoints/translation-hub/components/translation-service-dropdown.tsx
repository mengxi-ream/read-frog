import { browser, i18n } from '#imports'
import { IconSettings } from '@tabler/icons-react'
import { useAtomValue } from 'jotai'
import { useMemo } from 'react'
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
import { filterEnabledProvidersConfig, getLLMTranslateProvidersConfig, getNonAPIProvidersConfig, getPureAPIProvidersConfig } from '@/utils/config/helpers'
import { PROVIDER_ITEMS } from '@/utils/constants/providers'
import { selectedServicesAtom } from '../atoms'

interface TranslationServiceDropdownProps {
  onServicesChange: (selectedIds: string[]) => void
}

export function TranslationServiceDropdown({
  onServicesChange,
}: TranslationServiceDropdownProps) {
  const { theme = 'light' } = useTheme()
  const selectedServices = useAtomValue(selectedServicesAtom)
  const providersConfig = useAtomValue(configFieldsAtomMap.providersConfig)
  const filteredProvidersConfig = filterEnabledProvidersConfig(providersConfig)

  const selectedIds = useMemo(() => selectedServices.map(s => s.id), [selectedServices])

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
        onValueChange={onServicesChange}
      >
        <SelectTrigger className="min-w-52">
          <SelectValue placeholder={i18n.t('translateService.selectServices')}>
            {selectedServices.length > 0 && (
              <div className="flex items-center gap-2">
                <span>{i18n.t('translateService.translationProviders')}</span>
                <span className="text-xs bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full">
                  {selectedServices.length}
                </span>
              </div>
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

      <Button variant="outline" size="icon-lg" onClick={handleConfigureAPI} title={i18n.t('translateService.configureAPI')}>
        <IconSettings className="h-4 w-4" />
      </Button>
    </div>
  )
}
