import { Switch } from "@/components/ui/Switch";
import { configFields } from "@/utils/atoms/config";
import { useAtom } from "jotai";

export default function Hotkey() {
  const [manualTranslate, setManualTranslate] = useAtom(
    configFields.manualTranslate
  );

  return (
    <div className="flex items-center justify-between gap-2">
      <span className="font-medium text-[13px]">Hotkey</span>
      <Switch
        checked={manualTranslate.enabled}
        onCheckedChange={(checked) => setManualTranslate({ enabled: checked })}
      />
    </div>
  );
}
