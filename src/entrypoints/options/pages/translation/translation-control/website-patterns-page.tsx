import type { ReactNode } from "react"
import { useAtom } from "jotai"
import { usePatternList } from "@/hooks/use-pattern-list"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { i18n } from "@/utils/i18n"
import { ConfigDetailSection } from "../../../components/config-detail-section"
import { PageLayout } from "../../../components/page-layout"
import { PatternsTable } from "../../../components/patterns-table"

/**
 * A list of URL patterns, drilled into from the Translation control section. The list grows
 * without limit and each row carries a delete button, which is more than a settings row can
 * hold — so the row only says what the list is for and how many ways in there are.
 */
function WebsitePatternsPage({
  anchorId,
  title,
  patterns,
  onPatternsChange,
  placeholderText,
  tableHeaderText,
}: {
  anchorId: string
  title: ReactNode
  patterns: string[]
  onPatternsChange: (patterns: string[]) => void
  placeholderText: string
  tableHeaderText: string
}) {
  const { addPattern, removePattern } = usePatternList(patterns, onPatternsChange)

  return (
    <PageLayout
      title={i18n.t("options.translation.title")}
      description={i18n.t("options.translation.pageDescription")}
    >
      <ConfigDetailSection
        backTo="/page-translation/translation-control"
        title={<span id={anchorId}>{title}</span>}
      >
        <PatternsTable
          patterns={patterns}
          onAddPattern={addPattern}
          onRemovePattern={removePattern}
          placeholderText={placeholderText}
          tableHeaderText={tableHeaderText}
          rowsClassName="max-h-none"
        />
      </ConfigDetailSection>
    </PageLayout>
  )
}

export function AutoTranslateWebsitesPage() {
  const [translateConfig, setTranslateConfig] = useAtom(configFieldsAtomMap.translate)

  return (
    <WebsitePatternsPage
      anchorId="auto-translate-website"
      title={i18n.t("options.translation.translationControl.autoTranslateWebsite.title")}
      patterns={translateConfig.page.autoTranslatePatterns}
      onPatternsChange={(autoTranslatePatterns) => {
        void setTranslateConfig({ page: { ...translateConfig.page, autoTranslatePatterns } })
      }}
      placeholderText={i18n.t(
        "options.translation.translationControl.autoTranslateWebsite.enterUrlPattern",
      )}
      tableHeaderText={i18n.t(
        "options.translation.translationControl.autoTranslateWebsite.urlPattern",
      )}
    />
  )
}

export function NeverAutoTranslateWebsitesPage() {
  const [translateConfig, setTranslateConfig] = useAtom(configFieldsAtomMap.translate)

  return (
    <WebsitePatternsPage
      anchorId="never-auto-translate-website"
      title={i18n.t("options.translation.translationControl.neverAutoTranslateWebsite.title")}
      patterns={translateConfig.page.neverAutoTranslatePatterns}
      onPatternsChange={(neverAutoTranslatePatterns) => {
        void setTranslateConfig({ page: { ...translateConfig.page, neverAutoTranslatePatterns } })
      }}
      placeholderText={i18n.t(
        "options.translation.translationControl.neverAutoTranslateWebsite.enterUrlPattern",
      )}
      tableHeaderText={i18n.t(
        "options.translation.translationControl.neverAutoTranslateWebsite.urlPattern",
      )}
    />
  )
}
