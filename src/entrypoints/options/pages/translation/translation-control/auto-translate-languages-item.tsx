import type { LangCodeISO6393 } from "@read-frog/definitions"
import { useAtom } from "jotai"
import { MultiLanguageCombobox } from "@/components/multi-language-combobox"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { i18n } from "@/utils/i18n"
import { ConfigItem } from "../../../components/config-item"
import { LanguageChips } from "./language-chips"

export function AutoTranslateLanguagesItem() {
  const [translateConfig, setTranslateConfig] = useAtom(configFieldsAtomMap.pageTranslation)
  const selectedLanguages = translateConfig.page.autoTranslateLanguages

  const setLanguages = (languages: LangCodeISO6393[]) => {
    void setTranslateConfig({
      page: { ...translateConfig.page, autoTranslateLanguages: languages },
    })
  }

  return (
    <ConfigItem
      id="auto-translate-languages"
      title={i18n.t("options.translation.translationControl.autoTranslateLanguages.title")}
      description={
        <>
          {i18n.t("options.translation.translationControl.autoTranslateLanguages.description")}
          <LanguageChips
            languages={selectedLanguages}
            onRemove={(language) =>
              setLanguages(selectedLanguages.filter((selected) => selected !== language))
            }
          />
        </>
      }
    >
      <MultiLanguageCombobox
        selectedLanguages={selectedLanguages}
        onLanguagesChange={setLanguages}
        buttonLabel={i18n.t(
          "options.translation.translationControl.autoTranslateLanguages.selectLanguages",
        )}
      />
    </ConfigItem>
  )
}
