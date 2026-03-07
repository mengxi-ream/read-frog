import { i18n } from "#imports"
import { useAtom } from "jotai"
import { Label } from "@/components/ui/base-ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/base-ui/radio-group"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { ConfigCard } from "../../components/config-card"

export function FloatingButtonAnchor() {
  const [floatingButton, setFloatingButton] = useAtom(
    configFieldsAtomMap.floatingButton,
  )

  return (
    <ConfigCard
      id="floating-button-anchor"
      title={i18n.t("options.floatingButtonAndToolbar.floatingButton.anchor.title")}
      description={i18n.t("options.floatingButtonAndToolbar.floatingButton.anchor.description")}
    >
      <RadioGroup
        value={floatingButton.anchor}
        onValueChange={(value) => {
          if (value !== "left" && value !== "right") {
            return
          }

          void setFloatingButton({ ...floatingButton, anchor: value })
        }}
        className="flex flex-col gap-2 justify-center items-end"
      >
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="left" id="floating-button-anchor-left" />
          <Label htmlFor="floating-button-anchor-left" className="cursor-pointer">
            {i18n.t("options.floatingButtonAndToolbar.floatingButton.anchor.left")}
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="right" id="floating-button-anchor-right" />
          <Label htmlFor="floating-button-anchor-right" className="cursor-pointer">
            {i18n.t("options.floatingButtonAndToolbar.floatingButton.anchor.right")}
          </Label>
        </div>
      </RadioGroup>
    </ConfigCard>
  )
}
