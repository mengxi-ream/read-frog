import type { FloatingButtonClickAction as FloatingButtonClickActionValue } from "@/types/config/floating-button"
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
import { floatingButtonClickActionSchema } from "@/types/config/floating-button"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { ConfigCard } from "../../components/config-card"

const items = [
  { value: "panel", label: i18n.t("options.floatingButtonAndToolbar.floatingButton.clickAction.panel") },
  { value: "translate", label: i18n.t("options.floatingButtonAndToolbar.floatingButton.clickAction.translate") },
] satisfies Array<{ value: FloatingButtonClickActionValue, label: string }>

export function FloatingButtonClickAction() {
  const [floatingButton, setFloatingButton] = useAtom(
    configFieldsAtomMap.floatingButton,
  )

  return (
    <ConfigCard
      id="floating-button-click-action"
      title={i18n.t("options.floatingButtonAndToolbar.floatingButton.clickAction.title")}
      description={i18n.t("options.floatingButtonAndToolbar.floatingButton.clickAction.description")}
    >
      <div className="w-full flex justify-end">
        <Select
          items={items}
          value={floatingButton.clickAction}
          onValueChange={(value) => {
            const parsedValue = floatingButtonClickActionSchema.safeParse(value)
            if (!parsedValue.success)
              return
            void setFloatingButton({ ...floatingButton, clickAction: parsedValue.data })
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
