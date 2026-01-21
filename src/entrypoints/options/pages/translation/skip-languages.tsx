import type { LangCodeISO6393 } from '@read-frog/definitions'
import { i18n } from '#imports'
import { Icon } from '@iconify/react'
import {
  LANG_CODE_TO_EN_NAME,
  LANG_CODE_TO_LOCALE_NAME,
  langCodeISO6393Schema,
} from '@read-frog/definitions'
import { deepmerge } from 'deepmerge-ts'
import { useAtom, useAtomValue } from 'jotai'
import { useMemo } from 'react'
import { LLMStatusIndicator } from '@/components/llm-status-indicator'
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
import { ConfigCard } from '../../components/config-card'

export function SkipLanguages() {
  const translateConfig = useAtomValue(configFieldsAtomMap.translate)
  const providersConfig = useAtomValue(configFieldsAtomMap.providersConfig)

  const hasLLMProvider = useMemo(() => {
    const providerConfig = getProviderConfigById(providersConfig, translateConfig.providerId)
    return providerConfig ? isLLMTranslateProviderConfig(providerConfig) : false
  }, [providersConfig, translateConfig.providerId])

  return (
    <div className="py-6 flex flex-col gap-y-4">
      <ConfigCard
        title={i18n.t('options.translation.skipLanguages.title')}
        description={(
          <>
            {i18n.t('options.translation.skipLanguages.description')}
            <LLMStatusIndicator hasLLMProvider={hasLLMProvider} />
          </>
        )}
        className="py-0"
      >
        <div className="flex flex-col gap-y-4">
          <SkipLanguagesLLMToggle />
          <SkipLanguagesSelector />
        </div>
      </ConfigCard>
      <SelectedSkipLanguageCells />
    </div>
  )
}

function SkipLanguagesLLMToggle() {
  const [translateConfig, setTranslateConfig] = useAtom(configFieldsAtomMap.translate)

  return (
    <Field orientation="horizontal">
      <FieldContent className="self-center">
        <FieldLabel htmlFor="skip-languages-llm-toggle">
          {i18n.t('options.translation.skipLanguages.enableLLMDetection')}
          <Hint content={i18n.t('options.translation.skipLanguages.enableLLMDetectionDescription')} />
        </FieldLabel>
      </FieldContent>
      <Switch
        id="skip-languages-llm-toggle"
        checked={translateConfig.page.enableSkipLanguagesLLMDetection}
        onCheckedChange={(checked) => {
          void setTranslateConfig(
            deepmerge(translateConfig, {
              page: { enableSkipLanguagesLLMDetection: checked },
            }),
          )
        }}
      />
    </Field>
  )
}

function SkipLanguagesSelector() {
  const [translateConfig, setTranslateConfig] = useAtom(configFieldsAtomMap.translate)
  const selectedLanguages = translateConfig.page.skipLanguages

  const allLanguages = langCodeISO6393Schema.options

  const handleLanguageToggle = (language: LangCodeISO6393, checked: boolean) => {
    void setTranslateConfig({
      page: {
        ...translateConfig.page,
        skipLanguages: checked
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
              {i18n.t('options.translation.skipLanguages.selectLanguages')}
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

function SelectedSkipLanguageCells() {
  const [translateConfig, setTranslateConfig] = useAtom(configFieldsAtomMap.translate)
  const selectedLanguages = translateConfig.page.skipLanguages

  const removeLanguage = (language: LangCodeISO6393) => {
    void setTranslateConfig({
      page: {
        ...translateConfig.page,
        skipLanguages: selectedLanguages.filter(lang => lang !== language),
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
