import type { LangCodeISO6393 } from "@read-frog/definitions"
import { i18n } from "#imports"
import { Icon } from "@iconify/react"
import {
  LANG_CODE_TO_EN_NAME,
  LANG_CODE_TO_LOCALE_NAME,
} from "@read-frog/definitions"
import { deepmerge } from "deepmerge-ts"
import { useAtom, useAtomValue } from "jotai"
import { useMemo } from "react"
import { HelpTooltip } from "@/components/help-tooltip"
import { LLMStatusIndicator } from "@/components/llm-status-indicator"
import { MultiLanguageCombobox } from "@/components/multi-language-combobox"
import { Button } from "@/components/ui/base-ui/button"
import { Field, FieldContent, FieldLabel } from "@/components/ui/base-ui/field"
import { Label } from "@/components/ui/base-ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/base-ui/radio-group"
import { isLLMProviderConfig } from "@/types/config/provider"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { getProviderConfigById } from "@/utils/config/helpers"
import { ConfigCard } from "../../components/config-card"

export function SkipLanguages() {
  const translateConfig = useAtomValue(configFieldsAtomMap.translate)
  const providersConfig = useAtomValue(configFieldsAtomMap.providersConfig)

  const hasLLMProvider = useMemo(() => {
    const providerConfig = getProviderConfigById(providersConfig, translateConfig.providerId)
    return providerConfig ? isLLMProviderConfig(providerConfig) : false
  }, [providersConfig, translateConfig.providerId])

  return (
    <div className="py-6 flex flex-col gap-y-4">
      <ConfigCard
        title={i18n.t("options.translation.skipLanguages.title")}
        description={(
          <>
            {i18n.t("options.translation.skipLanguages.description")}
            <LLMStatusIndicator hasLLMProvider={hasLLMProvider} featureName={i18n.t("options.general.featureProviders.features.translate")} />
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
        <FieldLabel>
          {i18n.t("options.translation.skipLanguages.detection.label")}
          <HelpTooltip>{i18n.t("options.translation.skipLanguages.detection.description")}</HelpTooltip>
        </FieldLabel>
      </FieldContent>
      <RadioGroup
        value={translateConfig.page.enableSkipLanguagesLLMDetection ? "llm" : "basic"}
        onValueChange={(value: string) => {
          void setTranslateConfig(
            deepmerge(translateConfig, {
              page: { enableSkipLanguagesLLMDetection: value === "llm" },
            }),
          )
        }}
        className="flex flex-row gap-4 w-auto"
      >
        <div className="flex items-center gap-2">
          <RadioGroupItem value="basic" id="skip-languages-detection-basic" />
          <Label htmlFor="skip-languages-detection-basic">{i18n.t("options.translation.skipLanguages.detection.basic")}</Label>
        </div>
        <div className="flex items-center gap-2">
          <RadioGroupItem value="llm" id="skip-languages-detection-llm" />
          <Label htmlFor="skip-languages-detection-llm">{i18n.t("options.translation.skipLanguages.detection.llm")}</Label>
        </div>
      </RadioGroup>
    </Field>
  )
}

function SkipLanguagesSelector() {
  const [translateConfig, setTranslateConfig] = useAtom(configFieldsAtomMap.translate)
  const selectedLanguages = translateConfig.page.skipLanguages

  return (
    <div className="w-full flex justify-start md:justify-end">
      <MultiLanguageCombobox
        selectedLanguages={selectedLanguages}
        onLanguagesChange={languages =>
          void setTranslateConfig({
            page: {
              ...translateConfig.page,
              skipLanguages: languages,
            },
          })}
        buttonLabel={i18n.t("options.translation.skipLanguages.selectLanguages")}
      />
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
