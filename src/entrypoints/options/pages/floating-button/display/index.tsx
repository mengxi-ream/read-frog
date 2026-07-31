import type { FloatingButtonSide } from "@/types/config/floating-button"
import { useAtom } from "jotai"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/base-ui/select"
import { usePatternList } from "@/hooks/use-pattern-list"
import { floatingButtonSideSchema } from "@/types/config/floating-button"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { i18n } from "@/utils/i18n"
import { ConfigItem } from "../../../components/config-item"
import { ConfigSection } from "../../../components/config-section"
import { PatternsTable } from "../../../components/patterns-table"

/** Where the button shows up — which edge it docks to, and the sites it stays off entirely. */
export function DisplaySection() {
  const [floatingButton, setFloatingButton] = useAtom(configFieldsAtomMap.floatingButton)
  const { disabledFloatingButtonPatterns } = floatingButton

  // Resolved at render (not module scope) so labels follow a runtime UI-language switch.
  const sides = [
    {
      value: "right",
      label: i18n.t("options.floatingButtonAndToolbar.floatingButton.display.side.right"),
    },
    {
      value: "left",
      label: i18n.t("options.floatingButtonAndToolbar.floatingButton.display.side.left"),
    },
  ] satisfies Array<{ value: FloatingButtonSide; label: string }>

  const { addPattern, removePattern } = usePatternList(
    disabledFloatingButtonPatterns,
    (nextPatterns) => {
      void setFloatingButton({
        ...floatingButton,
        disabledFloatingButtonPatterns: nextPatterns,
      })
    },
  )

  return (
    <ConfigSection
      id="floating-button-display"
      title={i18n.t("options.floatingButtonAndToolbar.floatingButton.display.title")}
    >
      <ConfigItem
        id="floating-button-side"
        title={i18n.t("options.floatingButtonAndToolbar.floatingButton.display.side.title")}
        description={i18n.t(
          "options.floatingButtonAndToolbar.floatingButton.display.side.description",
        )}
      >
        <Select
          items={sides}
          value={floatingButton.side}
          onValueChange={(value) => {
            const parsedValue = floatingButtonSideSchema.safeParse(value)
            if (!parsedValue.success) return
            void setFloatingButton({ ...floatingButton, side: parsedValue.data })
          }}
        >
          <SelectTrigger size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            <SelectGroup>
              {sides.map((side) => (
                <SelectItem key={side.value} value={side.value}>
                  {side.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </ConfigItem>
      <ConfigItem
        id="floating-button-disabled-sites"
        orientation="vertical"
        title={i18n.t(
          "options.floatingButtonAndToolbar.floatingButton.display.disabledSites.title",
        )}
        description={i18n.t(
          "options.floatingButtonAndToolbar.floatingButton.display.disabledSites.description",
        )}
      >
        <PatternsTable
          patterns={disabledFloatingButtonPatterns}
          onAddPattern={addPattern}
          onRemovePattern={removePattern}
          placeholderText={i18n.t(
            "options.floatingButtonAndToolbar.floatingButton.display.disabledSites.enterUrlPattern",
          )}
          tableHeaderText={i18n.t(
            "options.floatingButtonAndToolbar.floatingButton.display.disabledSites.urlPattern",
          )}
        />
      </ConfigItem>
    </ConfigSection>
  )
}
