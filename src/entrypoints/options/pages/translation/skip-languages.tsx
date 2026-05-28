import type { LangCodeISO6393 } from "@read-frog/definitions"
import { Icon } from "@iconify/react"
import { useAtom } from "jotai"
import { i18n } from "#imports"
import { HelpTooltip } from "@/components/help-tooltip"
import { MultiLanguageCombobox } from "@/components/multi-language-combobox"
import { Button } from "@/components/ui/base-ui/button"
import { Field, FieldContent, FieldLabel } from "@/components/ui/base-ui/field"
import { Switch } from "@/components/ui/base-ui/switch"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { getLanguageLabel } from "@/utils/language-labels"
import { ConfigCard } from "../../components/config-card"

export function SkipLanguages() {
  return (
    <div className="py-6 flex flex-col gap-y-4">
      <ConfigCard
        id="skip-languages"
        title={i18n.t("options.translation.skipLanguages.title")}
        description={i18n.t("options.translation.skipLanguages.description")}
        className="py-0"
      >
        <div className="flex flex-col gap-4">
          <TargetLanguageSkipToggle />
          <SkipLanguagesSelector />
        </div>
      </ConfigCard>
      <SelectedSkipLanguageCells />
    </div>
  )
}

function TargetLanguageSkipToggle() {
  const [translateConfig, setTranslateConfig] = useAtom(configFieldsAtomMap.translate)

  return (
    <Field orientation="horizontal">
      <FieldContent className="self-center">
        <FieldLabel htmlFor="target-language-skip-toggle">
          {i18n.t("options.translation.skipLanguages.targetLanguageSkip")}
          <HelpTooltip>{i18n.t("options.translation.skipLanguages.targetLanguageSkipDescription")}</HelpTooltip>
        </FieldLabel>
      </FieldContent>
      <Switch
        id="target-language-skip-toggle"
        checked={translateConfig.page.enableTargetLanguageSkip}
        onCheckedChange={(checked) => {
          void setTranslateConfig({
            page: {
              ...translateConfig.page,
              enableTargetLanguageSkip: checked,
            },
          })
        }}
      />
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
          <span>{getLanguageLabel(language)}</span>
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
