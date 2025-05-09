import { Switch } from "@/components/ui/switch";
import { configFields } from "@/utils/atoms/config";
import { useAtom } from "jotai";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { HOTKEY_ITEMS, HOTKEYS } from "@/utils/constants/config";
import { Hotkey } from "@/types/config/config";

export default function HotkeySelector() {
  const [manualTranslate, setManualTranslate] = useAtom(
    configFields.manualTranslate
  );

  return (
    <div className="flex items-center justify-between gap-2">
      <Select
        value={manualTranslate.hotkey}
        onValueChange={(value: Hotkey) => setManualTranslate({ hotkey: value })}
      >
        <SelectTrigger
          size="sm"
          className="text-[13px] truncate pl-0 font-medium shadow-none cursor-pointer border-none bg-transparent ring-none focus-visible:border-none focus-visible:ring-0 hover:bg-transparent dark:hover:bg-transparent dark:bg-transparent"
        >
          <div className="truncate">
            Hover + {HOTKEY_ITEMS[manualTranslate.hotkey].icon}{" "}
            {HOTKEY_ITEMS[manualTranslate.hotkey].label} to translate paragraph
          </div>
        </SelectTrigger>
        <SelectContent>
          {HOTKEYS.map((item) => (
            <SelectItem key={item} value={item}>
              + {HOTKEY_ITEMS[item].icon} {HOTKEY_ITEMS[item].label} to
              translate paragraph
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Switch
        checked={manualTranslate.enabled}
        onCheckedChange={(checked) => setManualTranslate({ enabled: checked })}
      />
    </div>
  );
}
