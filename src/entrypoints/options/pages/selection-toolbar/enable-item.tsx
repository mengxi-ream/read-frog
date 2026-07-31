import { useAtom } from "jotai"
import { Switch } from "@/components/ui/base-ui/switch"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { i18n } from "@/utils/i18n"
import { ConfigItem } from "../../components/config-item"

/**
 * The switch every section below it only matters under, so it stands on its own above them
 * rather than heading one — there is no second row it belongs with.
 */
export function EnableItem() {
  const [selectionToolbar, setSelectionToolbar] = useAtom(configFieldsAtomMap.selectionToolbar)

  return (
    <ConfigItem
      id="selection-toolbar-toggle"
      title={i18n.t("options.selectionToolbar.enable.title")}
      description={i18n.t("options.selectionToolbar.enable.description")}
    >
      <Switch
        checked={selectionToolbar.enabled}
        onCheckedChange={(checked) => {
          void setSelectionToolbar({ ...selectionToolbar, enabled: checked })
        }}
      />
    </ConfigItem>
  )
}
