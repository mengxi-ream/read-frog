import { useAtom } from "jotai"
import { Switch } from "@/components/ui/base-ui/switch"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { i18n } from "@/utils/i18n"
import { ConfigCard } from "../../components/config-card"

export function SelectionToolbarSaveSuggestionToggle() {
  const [selectionToolbar, setSelectionToolbar] = useAtom(configFieldsAtomMap.selectionToolbar)

  return (
    <ConfigCard
      id="selection-toolbar-save-suggestion"
      title={i18n.t("options.floatingButtonAndToolbar.selectionToolbar.saveSuggestion.title")}
      description={i18n.t(
        "options.floatingButtonAndToolbar.selectionToolbar.saveSuggestion.description",
      )}
    >
      <div className="flex w-full justify-end">
        <Switch
          checked={selectionToolbar.saveSuggestion.enabled}
          onCheckedChange={(checked) =>
            void setSelectionToolbar({
              ...selectionToolbar,
              saveSuggestion: { ...selectionToolbar.saveSuggestion, enabled: checked },
            })
          }
        />
      </div>
    </ConfigCard>
  )
}
