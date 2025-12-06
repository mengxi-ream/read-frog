import type { LangCodeISO6393 } from '@read-frog/definitions'
import { i18n } from '#imports'
import { Icon } from '@iconify/react'
import {
  LANG_CODE_TO_EN_NAME,
  LANG_CODE_TO_LOCALE_NAME,
  langCodeISO6393Schema,
} from '@read-frog/definitions'
import { deepmerge } from 'deepmerge-ts'
import { useAtom } from 'jotai'
import { useMemo } from 'react'
import { Button } from '@/components/shadcn/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/shadcn/dropdown-menu'
import { Field, FieldContent, FieldLabel } from '@/components/shadcn/field'
import { Hint } from '@/components/shadcn/hint'
import { Switch } from '@/components/shadcn/switch'
import { isLLMTranslateProviderConfig } from '@/types/config/provider'
import { configFieldsAtomMap } from '@/utils/atoms/config'
import { getProviderConfigById } from '@/utils/config/helpers'
import { LLMStatusIndicator } from '../../../../components/llm-status-indicator'
import { ConfigCard } from '../../components/config-card'

export function AutoTranslateLanguages() {
  const [translateConfig] = useAtom(configFieldsAtomMap.translate)
  const [providersConfig] = useAtom(configFieldsAtomMap.providersConfig)

  const hasLLMProvider = useMemo(() => {
    const providerConfig = getProviderConfigById(providersConfig, translateConfig.providerId)
    return providerConfig ? isLLMTranslateProviderConfig(providerConfig) : false
  }, [providersConfig, translateConfig.providerId])

  return (
    <div className="py-6 flex flex-col gap-y-4">
      <ConfigCard
        title={i18n.t('options.translation.autoTranslateLanguages.title')}
        description={(
          <>
            {i18n.t('options.translation.autoTranslateLanguages.description')}
            <LLMStatusIndicator hasLLMProvider={hasLLMProvider} />
          </>
        )}
        className="py-0"
      >
        <div className="flex flex-col gap-y-4">
          <LLMDetectionToggle />
          <AutoTranslateLanguagesSelector />
        </div>
      </ConfigCard>
      <SelectedLanguageCells />
    </div>
  )
}

function LLMDetectionToggle() {
  const [translateConfig, setTranslateConfig] = useAtom(configFieldsAtomMap.translate)

  return (
    <Field orientation="horizontal">
      <FieldContent className="self-center">
        <FieldLabel htmlFor="llm-detection-toggle">
          {i18n.t('options.translation.autoTranslateLanguages.enableLLMDetection')}
          <Hint content={i18n.t('options.translation.autoTranslateLanguages.enableLLMDetectionDescription')} />
        </FieldLabel>
      </FieldContent>
      <Switch
        id="llm-detection-toggle"
        checked={translateConfig.page.enableLLMDetection}
        onCheckedChange={(checked) => {
          void setTranslateConfig(
            deepmerge(translateConfig, {
              page: { enableLLMDetection: checked },
            }),
          )
        }}
      />
    </Field>
  )
}

function AutoTranslateLanguagesSelector() {
  const [translateConfig, setTranslateConfig] = useAtom(configFieldsAtomMap.translate)
  const selectedLanguages = translateConfig.page.autoTranslateLanguages

  const allLanguages = langCodeISO6393Schema.options

  const handleLanguageToggle = (language: LangCodeISO6393, checked: boolean) => {
    void setTranslateConfig({
      page: {
        ...translateConfig.page,
        autoTranslateLanguages: checked
          ? [...selectedLanguages, language]
          : selectedLanguages.filter(lang => lang !== language),
      },
    })
  }

  return (
    <div className="w-full flex justify-start md:justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="w-40 justify-between">
            <span className="truncate">
              {i18n.t('options.translation.autoTranslateLanguages.selectLanguages')}
            </span>
            <Icon icon="tabler:chevron-down" className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="max-h-60 overflow-y-auto" align="end">
          {allLanguages.map(language => (
            <DropdownMenuCheckboxItem
              key={language}
              checked={selectedLanguages.includes(language)}
              onCheckedChange={checked => handleLanguageToggle(language, checked)}
              onSelect={e => e.preventDefault()}
            >
              {`${LANG_CODE_TO_EN_NAME[language]} (${LANG_CODE_TO_LOCALE_NAME[language]})`}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

function SelectedLanguageCells() {
  const [translateConfig, setTranslateConfig] = useAtom(configFieldsAtomMap.translate)
  const selectedLanguages = translateConfig.page.autoTranslateLanguages

  const removeLanguage = (language: LangCodeISO6393) => {
    void setTranslateConfig({
      page: {
        ...translateConfig.page,
        autoTranslateLanguages: selectedLanguages.filter(lang => lang !== language),
      },
    })
  }

  if (selectedLanguages.length === 0) {
    return null
  }

  return (
    <div className="flex flex-wrap gap-2">
      {selectedLanguages.map(language => (
        <div
          key={language}
          className="inline-flex items-center gap-1 rounded-md border bg-muted px-2 py-1 text-sm"
        >
          <span>{`${LANG_CODE_TO_EN_NAME[language]} (${LANG_CODE_TO_LOCALE_NAME[language]})`}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-4 w-4 p-0 hover:bg-input hover:text-input-foreground"
            onClick={() => removeLanguage(language)}
          >
            <Icon icon="tabler:x" className="h-3 w-3" />
          </Button>
        </div>
      ))}
    </div>
  )
}
