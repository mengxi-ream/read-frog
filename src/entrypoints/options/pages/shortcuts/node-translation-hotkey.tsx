import { deepmerge } from "deepmerge-ts"
import { useAtom } from "jotai"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/base-ui/select"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { HOTKEY_ICONS, HOTKEYS } from "@/utils/constants/hotkeys"
import { i18n } from "@/utils/i18n"
import { ConfigItem } from "../../components/config-item"
import { SELECT_CONTENT_PROPS } from "../../components/select-content-props"

/**
 * The one shortcut that is picked from a list rather than recorded — it is a single held
 * modifier, not a combination. Turning the feature on and off stays on the Translation page;
 * this page only sets keys.
 */
export function NodeTranslationHotkey() {
  const [translateConfig, setTranslateConfig] = useAtom(configFieldsAtomMap.pageTranslation)
  const { hotkey } = translateConfig.node

  return (
    <ConfigItem
      id="node-translation-hotkey"
      title={i18n.t("options.shortcuts.nodeTranslation.title")}
      description={i18n.t("options.shortcuts.nodeTranslation.description")}
    >
      <Select
        value={hotkey}
        onValueChange={(value: (typeof HOTKEYS)[number] | null) => {
          if (!value) return
          void setTranslateConfig(deepmerge(translateConfig, { node: { hotkey: value } }))
        }}
      >
        <SelectTrigger className="w-44">
          <SelectValue render={<span />}>
            {HOTKEY_ICONS[hotkey]} {i18n.t(`hotkey.${hotkey}`)}
          </SelectValue>
        </SelectTrigger>
        <SelectContent {...SELECT_CONTENT_PROPS}>
          <SelectGroup>
            {HOTKEYS.map((item) => (
              <SelectItem key={item} value={item}>
                {HOTKEY_ICONS[item]} {i18n.t(`hotkey.${item}`)}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </ConfigItem>
  )
}
