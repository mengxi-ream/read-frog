import { useAtom } from "jotai"
import { usePatternList } from "@/hooks/use-pattern-list"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { i18n } from "@/utils/i18n"
import { ConfigCard } from "../../components/config-card"
import { PatternsTable } from "../../components/patterns-table"

export function SelectionToolbarDisabledSites() {
  const [selectionToolbarConfig, setSelectionToolbarConfig] = useAtom(
    configFieldsAtomMap.selectionToolbar,
  )
  const { disabledSelectionToolbarPatterns } = selectionToolbarConfig

  const { addPattern, removePattern } = usePatternList(
    disabledSelectionToolbarPatterns,
    (nextPatterns) => {
      void setSelectionToolbarConfig({
        ...selectionToolbarConfig,
        disabledSelectionToolbarPatterns: nextPatterns,
      })
    },
  )

  return (
    <ConfigCard
      id="selection-toolbar-disabled-sites"
      title={i18n.t("options.floatingButtonAndToolbar.selectionToolbar.disabledSites.title")}
      description={i18n.t(
        "options.floatingButtonAndToolbar.selectionToolbar.disabledSites.description",
      )}
    >
      <PatternsTable
        patterns={disabledSelectionToolbarPatterns}
        onAddPattern={addPattern}
        onRemovePattern={removePattern}
        placeholderText={i18n.t(
          "options.floatingButtonAndToolbar.selectionToolbar.disabledSites.enterUrlPattern",
        )}
        tableHeaderText={i18n.t(
          "options.floatingButtonAndToolbar.selectionToolbar.disabledSites.urlPattern",
        )}
      />
    </ConfigCard>
  )
}
