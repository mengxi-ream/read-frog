import { i18n } from "#imports"
import { useAtom } from "jotai"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { ConfigCard } from "../../components/config-card"
import { PatternsTable } from "../../components/patterns-table"

export function SelectionTranslationDisabledSites() {
  const [selectionTranslation, setSelectionTranslation] = useAtom(configFieldsAtomMap.selectionTranslation)
  const { disabledSites = [] } = selectionTranslation

  const addPattern = (pattern: string) => {
    const cleanedPattern = pattern.trim()
    if (!cleanedPattern || disabledSites.includes(cleanedPattern))
      return

    void setSelectionTranslation({
      ...selectionTranslation,
      disabledSites: [...disabledSites, cleanedPattern],
    })
  }

  const removePattern = (pattern: string) => {
    void setSelectionTranslation({
      ...selectionTranslation,
      disabledSites: disabledSites.filter((p: string) => p !== pattern),
    })
  }

  return (
    <ConfigCard
      id="selection-translation-disabled-sites"
      title={i18n.t("options.selectionTranslation.disabledSites.title")}
      description={i18n.t("options.selectionTranslation.disabledSites.description")}
    >
      <PatternsTable
        patterns={disabledSites}
        onAddPattern={addPattern}
        onRemovePattern={removePattern}
        placeholderText={i18n.t("options.selectionTranslation.disabledSites.enterUrlPattern")}
        tableHeaderText={i18n.t("options.selectionTranslation.disabledSites.urlPattern")}
      />
    </ConfigCard>
  )
}
