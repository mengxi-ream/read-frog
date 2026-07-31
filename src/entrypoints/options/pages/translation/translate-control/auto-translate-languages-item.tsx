import type { LangCodeISO6393 } from "@read-frog/definitions"
import { useAtom } from "jotai"
import { MultiLanguageCombobox } from "@/components/multi-language-combobox"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { i18n } from "@/utils/i18n"
import { ConfigItem } from "../../../components/config-item"
import { LanguageChips } from "./language-chips"

export function AutoTranslateLanguagesItem() {
  const [translateConfig, setTranslateConfig] = useAtom(configFieldsAtomMap.translate)
  const selectedLanguages = translateConfig.page.autoTranslateLanguages

  const setLanguages = (languages: LangCodeISO6393[]) => {
    void setTranslateConfig({
      page: { ...translateConfig.page, autoTranslateLanguages: languages },
    })
  }

  return (
    <ConfigItem
      id="auto-translate-languages"
      title={i18n.t("options.translation.autoTranslateLanguages.title")}
      description={i18n.t("options.translation.autoTranslateLanguages.description")}
    >
      <div className="flex flex-col items-end gap-3">
        <MultiLanguageCombobox
          selectedLanguages={selectedLanguages}
          onLanguagesChange={setLanguages}
          buttonLabel={i18n.t("options.translation.autoTranslateLanguages.selectLanguages")}
        />
        <LanguageChips
          languages={selectedLanguages}
          onRemove={(language) =>
            setLanguages(selectedLanguages.filter((selected) => selected !== language))
          }
        />
      </div>
    </ConfigItem>
  )
}
