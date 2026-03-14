import type { LangCodeISO6393 } from "@read-frog/definitions"
import { i18n } from "#imports"
import { Icon } from "@iconify/react"
import {
  LANG_CODE_TO_EN_NAME,
  LANG_CODE_TO_LOCALE_NAME,
} from "@read-frog/definitions"
import { useAtom } from "jotai"
import { MultiLanguageCombobox } from "@/components/multi-language-combobox"
import { Button } from "@/components/ui/base-ui/button"
import { configFieldsAtomMap } from "@/utils/atoms/config"
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
        <SkipLanguagesSelector />
      </ConfigCard>
      <SelectedSkipLanguageCells />
    </div>
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
