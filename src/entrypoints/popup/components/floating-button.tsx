import { i18n } from "#imports"
import { useAtom } from "jotai"
import { Switch } from "@/components/ui/base-ui/switch"
import { configFieldsAtomMap } from "@/utils/atoms/config"

export default function FloatingButton() {
  const [floatingButton, setFloatingButton] = useAtom(
    configFieldsAtomMap.floatingButton,
  )

  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[13px] font-medium">
        {i18n.t("popup.enabledFloatingButton")}
      </span>
      <Switch
        checked={floatingButton.enabled}
        onCheckedChange={(checked) => {
          void setFloatingButton({ enabled: checked })
        }}
      />
    </div>
  )
}
