import type { TranslationMode as TranslationModeType } from '@/types/config/translate'
import { i18n } from '#imports'
import { deepmerge } from 'deepmerge-ts'
import { useAtom, useAtomValue } from 'jotai'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shadcn/select'
import { TRANSLATION_MODES } from '@/types/config/translate'
import { configFieldsAtomMap } from '@/utils/atoms/config'
import { filterEnabledProvidersConfig, getLLMTranslateProvidersConfig, getProviderConfigById } from '@/utils/config/helpers'
import { ConfigCard } from '../../components/config-card'

export function TranslationMode() {
  return (
    <ConfigCard title={i18n.t('options.translation.translationMode.title')} description={i18n.t('options.translation.translationMode.description')}>
      <TranslationModeSelector />
    </ConfigCard>
  )
}

function TranslationModeSelector() {
  const [translateConfig, setTranslateConfig] = useAtom(configFieldsAtomMap.translate)
  const providersConfig = useAtomValue(configFieldsAtomMap.providersConfig)
  const currentMode = translateConfig.mode

  const handleModeChange = (mode: TranslationModeType) => {
    const currentProvider = getProviderConfigById(providersConfig, translateConfig.providerId)

    if (mode === 'translationOnly' && currentProvider && currentProvider.provider === 'google-translate') {
      const enabledProviders = filterEnabledProvidersConfig(providersConfig)

      const microsoftProvider = enabledProviders.find(p => p.provider === 'microsoft-translate')
      if (microsoftProvider) {
        void setTranslateConfig(
          deepmerge(translateConfig, {
            mode,
            providerId: microsoftProvider.id,
          }),
        )
        return
      }

      const llmProviders = getLLMTranslateProvidersConfig(enabledProviders)
      if (llmProviders.length > 0) {
        void setTranslateConfig(
          deepmerge(translateConfig, {
            mode,
            providerId: llmProviders[0].id,
          }),
        )
        return
      }
    }

    void setTranslateConfig(
      deepmerge(translateConfig, { mode }),
    )
  }

  return (
    <div className="w-full flex justify-start md:justify-end">
      <Select
        value={currentMode}
        onValueChange={handleModeChange}
      >
        <SelectTrigger className="w-40">
          <SelectValue asChild>
            <span>
              {i18n.t(`options.translation.translationMode.mode.${currentMode}`)}
            </span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {TRANSLATION_MODES.map(mode => (
              <SelectItem key={mode} value={mode}>
                {i18n.t(`options.translation.translationMode.mode.${mode}`)}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  )
}
