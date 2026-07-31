import type { LangCodeISO6393 } from "@read-frog/definitions"
import { useAtom } from "jotai"
import { HelpTooltip } from "@/components/help-tooltip"
import { MultiLanguageCombobox } from "@/components/multi-language-combobox"
import { Label } from "@/components/ui/base-ui/label"
import { Switch } from "@/components/ui/base-ui/switch"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { i18n } from "@/utils/i18n"
import { ConfigItem } from "../../../components/config-item"
import { LanguageChips } from "./language-chips"

/**
 * Two ways of skipping a paragraph, on one row: the target language, which is detected rather
 * than listed, and whatever else the reader already reads.
 */
export function SkipLanguagesItem() {
  const [translateConfig, setTranslateConfig] = useAtom(configFieldsAtomMap.translate)
  const selectedLanguages = translateConfig.page.skipLanguages

  const setLanguages = (languages: LangCodeISO6393[]) => {
    void setTranslateConfig({ page: { ...translateConfig.page, skipLanguages: languages } })
  }

  return (
    <ConfigItem
      id="skip-languages"
      title={i18n.t("options.translation.skipLanguages.title")}
      description={i18n.t("options.translation.skipLanguages.description")}
    >
      <div className="flex flex-col items-end gap-3">
        <div className="flex items-center gap-3">
          <Label htmlFor="target-language-skip-toggle">
            {i18n.t("options.translation.skipLanguages.targetLanguageSkip")}
            <HelpTooltip>
              {i18n.t("options.translation.skipLanguages.targetLanguageSkipDescription")}
            </HelpTooltip>
          </Label>
          <Switch
            id="target-language-skip-toggle"
            checked={translateConfig.page.enableTargetLanguageSkip}
            onCheckedChange={(checked) => {
              void setTranslateConfig({
                page: { ...translateConfig.page, enableTargetLanguageSkip: checked },
              })
            }}
          />
        </div>
        <MultiLanguageCombobox
          selectedLanguages={selectedLanguages}
          onLanguagesChange={setLanguages}
          buttonLabel={i18n.t("options.translation.skipLanguages.selectLanguages")}
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
