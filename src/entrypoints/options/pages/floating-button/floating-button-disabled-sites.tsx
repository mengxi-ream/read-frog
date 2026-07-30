import { useAtom } from "jotai"
import { usePatternList } from "@/hooks/use-pattern-list"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { i18n } from "@/utils/i18n"
import { ConfigCard } from "../../components/config-card"
import { PatternsTable } from "../../components/patterns-table"

export function FloatingButtonDisabledSites() {
  const [floatingButtonConfig, setFloatingButtonConfig] = useAtom(
    configFieldsAtomMap.floatingButton,
  )
  const { disabledFloatingButtonPatterns } = floatingButtonConfig

  const { addPattern, removePattern } = usePatternList(
    disabledFloatingButtonPatterns,
    (nextPatterns) => {
      void setFloatingButtonConfig({
        ...floatingButtonConfig,
        disabledFloatingButtonPatterns: nextPatterns,
      })
    },
  )

  return (
    <ConfigCard
      id="floating-button-disabled-sites"
      title={i18n.t("options.floatingButtonAndToolbar.floatingButton.disabledSites.title")}
      description={i18n.t(
        "options.floatingButtonAndToolbar.floatingButton.disabledSites.description",
      )}
    >
      <PatternsTable
        patterns={disabledFloatingButtonPatterns}
        onAddPattern={addPattern}
        onRemovePattern={removePattern}
        placeholderText={i18n.t(
          "options.floatingButtonAndToolbar.floatingButton.disabledSites.enterUrlPattern",
        )}
        tableHeaderText={i18n.t(
          "options.floatingButtonAndToolbar.floatingButton.disabledSites.urlPattern",
        )}
      />
    </ConfigCard>
  )
}
