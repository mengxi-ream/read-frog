import type { NodeHotkey } from "@/utils/constants/hotkeys"
import { useAtom } from "jotai"
import { NodeHotkeyIcon } from "@/components/node-hotkey-icon"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/base-ui/select"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { HOTKEYS } from "@/utils/constants/hotkeys"
import { i18n } from "@/utils/i18n"
import { ConfigItem } from "../../components/config-item"
import { SELECT_CONTENT_PROPS } from "../../components/select-content-props"
import { ShortcutConfigItem } from "./shortcut-config-item"
import { TurnedOffNote } from "./turned-off-note"

const PRESET_HOTKEYS = HOTKEYS.filter((hotkey) => hotkey !== "custom")

/**
 * The one shortcut picked from a list: a single key held while hovering, or a long press. The
 * last choice records a combination instead, in a row under this one that is the same recorder
 * every other shortcut on the page has. Turning the feature on and off stays on the Translation
 * page; this page only sets keys.
 */
export function NodeTranslationHotkey() {
  const [translateConfig, setTranslateConfig] = useAtom(configFieldsAtomMap.pageTranslation)
  const { enabled, hotkey, shortcut } = translateConfig.node

  return (
    <>
      <ConfigItem
        id="node-translation-hotkey"
        title={i18n.t("options.shortcuts.nodeTranslation.title")}
        description={
          <>
            {i18n.t("options.shortcuts.nodeTranslation.description")}
            {!enabled && <TurnedOffNote />}
          </>
        }
      >
        <Select
          value={hotkey}
          onValueChange={(value: NodeHotkey | null) => {
            if (!value) return
            void setTranslateConfig((current) => ({ node: { ...current.node, hotkey: value } }))
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue render={<span />}>
              <HotkeyOption hotkey={hotkey} />
            </SelectValue>
          </SelectTrigger>
          <SelectContent {...SELECT_CONTENT_PROPS}>
            <SelectGroup>
              {PRESET_HOTKEYS.map((item) => (
                <SelectItem key={item} value={item}>
                  <HotkeyOption hotkey={item} />
                </SelectItem>
              ))}
            </SelectGroup>
            <SelectSeparator />
            <SelectGroup>
              <SelectItem value="custom">
                <HotkeyOption hotkey="custom" />
              </SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </ConfigItem>
      {hotkey === "custom" && (
        <ShortcutConfigItem
          id="node-translation-shortcut"
          description={i18n.t("options.shortcuts.nodeTranslation.customDescription")}
          shortcut={shortcut}
          onChange={(nextShortcut) => {
            void setTranslateConfig((current) => ({
              node: { ...current.node, shortcut: nextShortcut },
            }))
          }}
        />
      )}
    </>
  )
}

function HotkeyOption({ hotkey }: { hotkey: NodeHotkey }) {
  return (
    <>
      <NodeHotkeyIcon hotkey={hotkey} className="text-muted-foreground" />
      <span className="truncate">{i18n.t(`hotkey.${hotkey}`)}</span>
    </>
  )
}
