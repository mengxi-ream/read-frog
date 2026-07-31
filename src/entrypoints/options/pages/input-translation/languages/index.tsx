import type { InputTranslationLang } from "@/types/config/config"
import { Icon } from "@iconify/react"
import { useAtom, useAtomValue } from "jotai"
import { Activity } from "react"
import { Switch } from "@/components/ui/base-ui/switch"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { i18n } from "@/utils/i18n"
import { getLanguageLabel } from "@/utils/language-labels"
import { ConfigItem } from "../../../components/config-item"
import { ConfigSection } from "../../../components/config-section"
import { LangSelect } from "./lang-select"

/**
 * Which language the typed text is read as, and which one it comes back in. Both sides sit in
 * the row's control column, one above the other with the arrow between them, so the pair reads
 * as the direction it sets — and swapping shows in the arrow itself.
 */
export function LanguagesSection() {
  const [inputTranslation, setInputTranslation] = useAtom(configFieldsAtomMap.inputTranslation)
  const language = useAtomValue(configFieldsAtomMap.language)

  const getDisplayLabel = (value: InputTranslationLang) => {
    if (value === "sourceCode") {
      const label = i18n.t("options.inputTranslation.languages.sourceCode")
      if (language.sourceCode === "auto") {
        return `${label} (auto)`
      }
      return `${label} (${getLanguageLabel(language.sourceCode)})`
    }
    if (value === "targetCode") {
      const label = i18n.t("options.inputTranslation.languages.targetCode")
      return `${label} (${getLanguageLabel(language.targetCode)})`
    }
    return getLanguageLabel(value)
  }

  return (
    <ConfigSection
      id="input-translation-languages"
      title={i18n.t("options.inputTranslation.languages.title")}
    >
      <ConfigItem
        orientation="vertical"
        title={i18n.t("options.inputTranslation.languages.pair.title")}
        description={i18n.t("options.inputTranslation.languages.pair.description")}
      >
        {/* Side by side, each taking half the row, so the arrow between them points the way
            the text actually travels. */}
        <div className="flex w-full min-w-0 items-center gap-3">
          <LangSelect
            className="min-w-0 flex-1"
            value={inputTranslation.fromLang}
            onValueChange={(fromLang) => {
              void setInputTranslation({ ...inputTranslation, fromLang })
            }}
            getDisplayLabel={getDisplayLabel}
          />

          <div className="relative size-4 shrink-0">
            <Activity mode={inputTranslation.enableCycle ? "visible" : "hidden"}>
              <Icon
                icon="tabler:arrows-exchange"
                className="absolute inset-0 size-4 text-muted-foreground"
              />
            </Activity>
            <Activity mode={inputTranslation.enableCycle ? "hidden" : "visible"}>
              <Icon
                icon="tabler:arrow-right"
                className="absolute inset-0 size-4 text-muted-foreground"
              />
            </Activity>
          </div>

          <LangSelect
            className="min-w-0 flex-1"
            value={inputTranslation.toLang}
            onValueChange={(toLang) => {
              void setInputTranslation({ ...inputTranslation, toLang })
            }}
            getDisplayLabel={getDisplayLabel}
          />
        </div>
      </ConfigItem>
      <ConfigItem
        id="input-translation-cycle"
        title={i18n.t("options.inputTranslation.languages.cycle.title")}
        description={i18n.t("options.inputTranslation.languages.cycle.description")}
      >
        <Switch
          checked={inputTranslation.enableCycle}
          onCheckedChange={(checked) => {
            void setInputTranslation({ ...inputTranslation, enableCycle: checked })
          }}
        />
      </ConfigItem>
    </ConfigSection>
  )
}
