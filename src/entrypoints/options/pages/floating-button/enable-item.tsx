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
  const [floatingButton, setFloatingButton] = useAtom(configFieldsAtomMap.floatingButton)

  return (
    <ConfigItem
      id="floating-button-toggle"
      title={i18n.t("options.floatingButton.enable.title")}
      description={i18n.t("options.floatingButton.enable.description")}
    >
      <Switch
        checked={floatingButton.enabled}
        onCheckedChange={(checked) => {
          void setFloatingButton({ ...floatingButton, enabled: checked })
        }}
      />
    </ConfigItem>
  )
}
