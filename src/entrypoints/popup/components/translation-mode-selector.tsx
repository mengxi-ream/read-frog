import type { TranslationMode as TranslationModeType } from '@/types/config/translate'
import { i18n } from '#imports'
import { Icon } from '@iconify/react'
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/shadcn/tooltip'
import { TRANSLATION_MODES } from '@/types/config/translate'
import { configFieldsAtomMap } from '@/utils/atoms/config'
import { filterEnabledProvidersConfig, getLLMTranslateProvidersConfig, getProviderConfigById } from '@/utils/config/helpers'

export default function TranslationModeSelector() {
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
    <div className="flex items-center justify-between gap-2">
      <span className="text-[13px] font-medium flex items-center gap-1.5">
        {i18n.t('options.translation.translationMode.title')}
        <Tooltip>
          <TooltipTrigger asChild>
            <Icon icon="tabler:help" className="size-3 text-blue-300 dark:text-blue-700/70" />
          </TooltipTrigger>
          <TooltipContent className="w-36">
            <p>
              {i18n.t('options.translation.translationMode.description')}
            </p>
          </TooltipContent>
        </Tooltip>
      </span>
      <Select
        value={currentMode}
        onValueChange={handleModeChange}
      >
        <SelectTrigger className="h-7! w-31 pr-1.5 pl-2.5">
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
