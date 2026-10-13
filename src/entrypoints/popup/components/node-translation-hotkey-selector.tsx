import type { NodeHotkey } from "@/utils/constants/hotkeys"
import { useAtom } from "jotai"
import { NodeHotkeyIcon } from "@/components/node-hotkey-icon"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/base-ui/select"
import { Switch } from "@/components/ui/base-ui/switch"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { HOTKEY_ICONS, HOTKEYS } from "@/utils/constants/hotkeys"
import { i18n } from "@/utils/i18n"
import { formatHotkey } from "@/utils/os"

// A custom hotkey reads as the keys it records, like the single keys do.
function HotkeyDisplay({ hotkey, shortcut }: { hotkey: NodeHotkey; shortcut: string }) {
  if (hotkey === "clickAndHold") {
    return (
      <>
        <NodeHotkeyIcon hotkey={hotkey} /> {i18n.t("hotkey.clickAndHold")}{" "}
        {i18n.t("popup.translateParagraph")}
      </>
    )
  }

  const keys =
    hotkey === "custom"
      ? formatHotkey(shortcut) || i18n.t("hotkey.custom")
      : `${HOTKEY_ICONS[hotkey]} ${i18n.t(`hotkey.${hotkey}`)}`

  return (
    <>
      {i18n.t("popup.hover")} + {keys} {i18n.t("popup.translateParagraph")}
    </>
  )
}

export default function NodeTranslationHotkeySelector() {
  const [translateConfig, setTranslateConfig] = useAtom(configFieldsAtomMap.pageTranslation)
  const { enabled, hotkey, shortcut } = translateConfig.node

  return (
    <div className="flex items-center justify-between gap-2">
      <Select
        value={hotkey}
        onValueChange={(value: NodeHotkey | null) => {
          if (!value) return
          void setTranslateConfig((current) => ({ node: { ...current.node, hotkey: value } }))
        }}
      >
        <SelectTrigger
          size="sm"
          className="ring-none -mt-3.5 -mb-4 -ml-2 h-5! cursor-pointer truncate rounded-md border-none bg-transparent! px-2 pt-3.5 pb-4 text-[13px] font-medium shadow-none focus-visible:border-none focus-visible:ring-0"
        >
          <div className="truncate">
            <HotkeyDisplay hotkey={hotkey} shortcut={shortcut} />
          </div>
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {HOTKEYS.map((item) => (
              <SelectItem key={item} value={item}>
                <HotkeyDisplay hotkey={item} shortcut={shortcut} />
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      <Switch
        checked={enabled}
        onCheckedChange={(checked) => {
          void setTranslateConfig((current) => ({ node: { ...current.node, enabled: checked } }))
        }}
      />
    </div>
  )
}
