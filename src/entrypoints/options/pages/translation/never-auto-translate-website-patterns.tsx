import { useAtom } from "jotai"
import { usePatternList } from "@/hooks/use-pattern-list"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { i18n } from "@/utils/i18n"
import { ConfigCard } from "../../components/config-card"
import { PatternsTable } from "../../components/patterns-table"

export function NeverAutoTranslateWebsitePatterns() {
  const [translateConfig, setTranslateConfig] = useAtom(configFieldsAtomMap.translate)
  const { neverAutoTranslatePatterns } = translateConfig.page

  const { addPattern, removePattern } = usePatternList(
    neverAutoTranslatePatterns,
    (nextPatterns) => {
      void setTranslateConfig({
        page: { ...translateConfig.page, neverAutoTranslatePatterns: nextPatterns },
      })
    },
  )

  return (
    <ConfigCard
      id="never-auto-translate-website"
      title={i18n.t("options.translation.neverAutoTranslateWebsite.title")}
      description={i18n.t("options.translation.neverAutoTranslateWebsite.description")}
    >
      <PatternsTable
        patterns={neverAutoTranslatePatterns}
        onAddPattern={addPattern}
        onRemovePattern={removePattern}
        placeholderText={i18n.t("options.translation.neverAutoTranslateWebsite.enterUrlPattern")}
        tableHeaderText={i18n.t("options.translation.neverAutoTranslateWebsite.urlPattern")}
      />
    </ConfigCard>
  )
}
