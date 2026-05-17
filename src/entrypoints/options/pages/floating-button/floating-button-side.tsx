import type { FloatingButtonSide as FloatingButtonSideValue } from "@/types/config/floating-button"
import { useAtom } from "jotai"
import { i18n } from "#imports"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/base-ui/select"
import { floatingButtonSideSchema } from "@/types/config/floating-button"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { ConfigCard } from "../../components/config-card"

const items = [
  { value: "right", label: i18n.t("options.floatingButtonAndToolbar.floatingButton.side.right") },
  { value: "left", label: i18n.t("options.floatingButtonAndToolbar.floatingButton.side.left") },
] satisfies Array<{ value: FloatingButtonSideValue, label: string }>

export function FloatingButtonSide() {
  const [floatingButton, setFloatingButton] = useAtom(
    configFieldsAtomMap.floatingButton,
  )

  return (
    <ConfigCard
      id="floating-button-side"
      title={i18n.t("options.floatingButtonAndToolbar.floatingButton.side.title")}
      description={i18n.t("options.floatingButtonAndToolbar.floatingButton.side.description")}
    >
      <div className="w-full flex justify-end">
        <Select
          items={items}
          value={floatingButton.side}
          onValueChange={(value) => {
            const parsedValue = floatingButtonSideSchema.safeParse(value)
            if (!parsedValue.success)
              return
            void setFloatingButton({ ...floatingButton, side: parsedValue.data })
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
