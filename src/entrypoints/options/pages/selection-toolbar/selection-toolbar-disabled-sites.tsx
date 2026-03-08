import { i18n } from "#imports"
import { useAtom } from "jotai"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { ConfigCard } from "../../components/config-card"
import { PatternsTable } from "../../components/patterns-table"

export function SelectionToolbarDisabledSites() {
  const [selectionToolbarConfig, setSelectionToolbarConfig] = useAtom(configFieldsAtomMap.selectionToolbar)
  const { disabledSelectionToolbarPatterns = [] } = selectionToolbarConfig

  const addPattern = (pattern: string) => {
    const cleanedPattern = pattern.trim()
    if (!cleanedPattern || disabledSelectionToolbarPatterns.includes(cleanedPattern))
      return

    void setSelectionToolbarConfig({
      ...selectionToolbarConfig,
      disabledSelectionToolbarPatterns: [...disabledSelectionToolbarPatterns, cleanedPattern],
    })
  }

  const removePattern = (pattern: string) => {
    void setSelectionToolbarConfig({
      ...selectionToolbarConfig,
      disabledSelectionToolbarPatterns: disabledSelectionToolbarPatterns.filter((p: string) => p !== pattern),
    })
  }

  return (
    <ConfigCard
      id="selection-toolbar-disabled-sites"
      title={i18n.t("options.floatingButtonAndToolbar.selectionToolbar.disabledSites.title")}
      description={i18n.t("options.floatingButtonAndToolbar.selectionToolbar.disabledSites.description")}
    >
      <PatternsTable
        patterns={disabledSelectionToolbarPatterns}
        onAddPattern={addPattern}
        onRemovePattern={removePattern}
        placeholderText={i18n.t("options.floatingButtonAndToolbar.selectionToolbar.disabledSites.enterUrlPattern")}
        tableHeaderText={i18n.t("options.floatingButtonAndToolbar.selectionToolbar.disabledSites.urlPattern")}
      />
    </ConfigCard>
  )
}
