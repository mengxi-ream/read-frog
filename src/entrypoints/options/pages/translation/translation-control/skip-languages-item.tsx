import type { LangCodeISO6393 } from "@read-frog/definitions"
import { useAtom } from "jotai"
import { MultiLanguageCombobox } from "@/components/multi-language-combobox"
import { Switch } from "@/components/ui/base-ui/switch"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { i18n } from "@/utils/i18n"
import { ConfigItem } from "../../../components/config-item"
import { LanguageChips } from "./language-chips"

/**
 * Two ways of skipping a paragraph: the languages the reader lists, and the target language,
 * which is detected rather than listed. The second is a row of the first — it hangs off that
 * title, which is what lets its own explanation be the row instead of a tooltip beside a label.
 */
export function SkipLanguagesItem() {
  const [translateConfig, setTranslateConfig] = useAtom(configFieldsAtomMap.pageTranslation)
  const selectedLanguages = translateConfig.page.skipLanguages

  const setLanguages = (languages: LangCodeISO6393[]) => {
    void setTranslateConfig({ page: { ...translateConfig.page, skipLanguages: languages } })
  }

  return (
    <>
      <ConfigItem
        id="skip-languages"
        title={i18n.t("options.translation.translationControl.skipLanguages.title")}
        description={
          <>
            {i18n.t("options.translation.translationControl.skipLanguages.description")}
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
            "options.translation.translationControl.skipLanguages.selectLanguages",
          )}
        />
      </ConfigItem>
      <ConfigItem
        description={i18n.t(
          "options.translation.translationControl.skipLanguages.targetLanguageSkipDescription",
        )}
      >
        <Switch
          checked={translateConfig.page.enableTargetLanguageSkip}
          onCheckedChange={(checked) => {
            void setTranslateConfig({
              page: { ...translateConfig.page, enableTargetLanguageSkip: checked },
            })
          }}
        />
      </ConfigItem>
    </>
  )
}
