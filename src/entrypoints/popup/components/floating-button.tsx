import { Switch } from "@/components/ui/switch";
import { configFields } from "@/utils/atoms/config";
import { useAtom } from "jotai";

export default function FloatingButton() {
  const [floatingButton, setFloatingButton] = useAtom(
    configFields.floatingButton
  );

  return (
    <div className="flex items-center justify-between gap-2">
      <span className="font-medium text-[13px]">
        {i18n.t("popup.enabledFloatingButton")}
      </span>
      <Switch
        checked={floatingButton.enabled}
        onCheckedChange={(checked) => {
          setFloatingButton({ enabled: checked });
        }}
      />
    </div>
  );
}
