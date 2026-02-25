import { i18n } from "#imports"
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
import { ConfigCard } from "../../components/config-card"

const items = [
  { value: "panel", label: i18n.t("options.floatingButtonAndToolbar.floatingButton.clickAction.panel") },
  { value: "translate", label: i18n.t("options.floatingButtonAndToolbar.floatingButton.clickAction.translate") },
]

export function FloatingButtonClickAction() {
  const [floatingButton, setFloatingButton] = useAtom(
    configFieldsAtomMap.floatingButton,
  )

  return (
    <ConfigCard
      title={i18n.t("options.floatingButtonAndToolbar.floatingButton.clickAction.title")}
      description={i18n.t("options.floatingButtonAndToolbar.floatingButton.clickAction.description")}
    >
      <div className="w-full flex justify-end">
        <Select
          items={items}
          value={floatingButton.clickAction}
          onValueChange={(value) => {
            if (!value)
              return
            void setFloatingButton({ ...floatingButton, clickAction: value })
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end" className="min-w-fit">
            <SelectGroup>
              {items.map(item => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
    </ConfigCard>
  )
}
