import { useAtom } from "jotai"
import { usePatternList } from "@/hooks/use-pattern-list"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { i18n } from "@/utils/i18n"
import { ConfigItem } from "../../../components/config-item"
import { PatternsTable } from "../../../components/patterns-table"

export function AutoTranslateWebsiteItem() {
  const [translateConfig, setTranslateConfig] = useAtom(configFieldsAtomMap.translate)
  const { autoTranslatePatterns } = translateConfig.page

  const { addPattern, removePattern } = usePatternList(autoTranslatePatterns, (nextPatterns) => {
    void setTranslateConfig({
      page: { ...translateConfig.page, autoTranslatePatterns: nextPatterns },
    })
  })

  return (
    <ConfigItem
      id="auto-translate-website"
      orientation="vertical"
      title={i18n.t("options.translation.autoTranslateWebsite.title")}
      description={i18n.t("options.translation.autoTranslateWebsite.description")}
    >
      <PatternsTable
        patterns={autoTranslatePatterns}
        onAddPattern={addPattern}
        onRemovePattern={removePattern}
        placeholderText={i18n.t("options.translation.autoTranslateWebsite.enterUrlPattern")}
        tableHeaderText={i18n.t("options.translation.autoTranslateWebsite.urlPattern")}
      />
    </ConfigItem>
  )
}
