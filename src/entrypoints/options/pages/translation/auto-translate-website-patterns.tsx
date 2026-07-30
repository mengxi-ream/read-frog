import { useAtom } from "jotai"
import { usePatternList } from "@/hooks/use-pattern-list"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { i18n } from "@/utils/i18n"
import { ConfigCard } from "../../components/config-card"
import { PatternsTable } from "../../components/patterns-table"

export function AutoTranslateWebsitePatterns() {
  const [translateConfig, setTranslateConfig] = useAtom(configFieldsAtomMap.translate)
  const { autoTranslatePatterns } = translateConfig.page

  const { addPattern, removePattern } = usePatternList(autoTranslatePatterns, (nextPatterns) => {
    void setTranslateConfig({
      page: { ...translateConfig.page, autoTranslatePatterns: nextPatterns },
    })
  })

  return (
    <ConfigCard
      id="auto-translate-website"
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
    </ConfigCard>
  )
}
