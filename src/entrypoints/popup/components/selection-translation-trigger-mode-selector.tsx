import type { SelectionTriggerMode } from "@/types/config/config"
import { i18n } from "#imports"
import { useAtom, useAtomValue } from "jotai"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/base-ui/select"
import { configFieldsAtomMap } from "@/utils/atoms/config"

const TRIGGER_MODES: SelectionTriggerMode[] = ["toolbar", "direct", "ctrl", "alt", "shift"]

export function SelectionTranslationTriggerModeSelector() {
  const [selectionTranslation, setSelectionTranslation] = useAtom(configFieldsAtomMap.selectionTranslation)
  const selectionToolbar = useAtomValue(configFieldsAtomMap.selectionToolbar)

  const isDisabled = !selectionTranslation.enabled || !selectionToolbar.enabled

  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[13px] font-medium">
        {i18n.t("popup.selectionTranslation")}
      </span>
      <Select
        value={selectionTranslation.triggerMode}
        onValueChange={(value) => {
          if (value) {
            void setSelectionTranslation({ ...selectionTranslation, triggerMode: value as SelectionTriggerMode })
          }
        }}
        disabled={isDisabled}
      >
        <SelectTrigger className="h-7! w-31">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {TRIGGER_MODES.map(mode => (
              <SelectItem key={mode} value={mode}>
                {i18n.t(`selectionTriggerMode.${mode}`)}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  )
}
