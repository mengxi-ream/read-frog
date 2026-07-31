import { useAtom } from "jotai"
import { Switch } from "@/components/ui/base-ui/switch"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { i18n } from "@/utils/i18n"
import { ConfigItem } from "../../components/config-item"

/** The page's one setting, so it stands on its own — a section would only head a single row. */
export function EnableItem() {
  const [contextMenu, setContextMenu] = useAtom(configFieldsAtomMap.contextMenu)

  return (
    <ConfigItem
      id="context-menu-translate"
      title={i18n.t("options.contextMenu.enable.title")}
      description={i18n.t("options.contextMenu.enable.description")}
    >
      <Switch
        checked={contextMenu.enabled}
        onCheckedChange={(checked) => {
          void setContextMenu({ ...contextMenu, enabled: checked })
        }}
      />
    </ConfigItem>
  )
}
