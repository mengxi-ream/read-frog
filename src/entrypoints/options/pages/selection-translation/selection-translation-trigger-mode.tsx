import type { SelectionTriggerMode } from "@/types/config/config"
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

const TRIGGER_MODES: SelectionTriggerMode[] = ["toolbar", "direct", "ctrl", "alt", "shift"]

export function SelectionTranslationTriggerMode() {
  const [selectionTranslation, setSelectionTranslation] = useAtom(
    configFieldsAtomMap.selectionTranslation,
  )

  return (
    <ConfigCard
      id="selection-translation-trigger-mode"
      title={i18n.t("options.selectionTranslation.triggerMode.title")}
      description={i18n.t("options.selectionTranslation.triggerMode.description")}
    >
      <Select
        value={selectionTranslation.triggerMode}
        onValueChange={(value) => {
          if (value) {
            void setSelectionTranslation({ ...selectionTranslation, triggerMode: value as SelectionTriggerMode })
          }
        }}
      >
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {TRIGGER_MODES.map(mode => (
              <SelectItem key={mode} value={mode}>
                {i18n.t(`options.selectionTranslation.triggerMode.${mode}`)}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </ConfigCard>
  )
}
