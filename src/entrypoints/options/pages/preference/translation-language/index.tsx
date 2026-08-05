import { useAtom } from "jotai"
import { LanguageCombobox } from "@/components/language-combobox"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { i18n } from "@/utils/i18n"
import { ConfigItem } from "../../../components/config-item"
import { ConfigSection } from "../../../components/config-section"

/**
 * The language pair every translation feature starts from. The popup edits these same two
 * fields next to a live page; here there is no page, so the source side offers auto by
 * description rather than resolving it to whatever tab was last detected.
 *
 * `triggerSize="sm"` is the same box the selects above render; a sm button shrinks its text
 * too, so `text-sm` holds the label at the 14px those selects read at.
 */
export function TranslationLanguageSection() {
  const [language, setLanguage] = useAtom(configFieldsAtomMap.language)

  return (
    <ConfigSection title={i18n.t("options.preference.translationLanguage.title")}>
      <ConfigItem
        id="translation-source-language"
        title={i18n.t("options.preference.translationLanguage.sourceCode.title")}
        description={i18n.t("options.preference.translationLanguage.sourceCode.description")}
      >
        <LanguageCombobox
          triggerSize="sm"
          className="text-sm"
          value={language.sourceCode}
          autoLabel={i18n.t("options.preference.translationLanguage.sourceCode.auto")}
          onValueChange={(sourceCode) => {
            void setLanguage({ sourceCode })
          }}
        />
      </ConfigItem>
      <ConfigItem
        id="translation-target-language"
        title={i18n.t("options.preference.translationLanguage.targetCode.title")}
        description={i18n.t("options.preference.translationLanguage.targetCode.description")}
      >
        <LanguageCombobox
          triggerSize="sm"
          className="text-sm"
          value={language.targetCode}
          // No `autoLabel`, so the list holds real languages only — there is nothing for a
          // target to auto-detect from. The guard keeps the type honest.
          onValueChange={(targetCode) => {
            if (targetCode === "auto") return
            void setLanguage({ targetCode })
          }}
        />
      </ConfigItem>
    </ConfigSection>
  )
}
