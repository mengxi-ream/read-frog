import { i18n } from "#imports"
import { useAtom } from "jotai"
import { Switch } from "@/components/ui/base-ui/switch"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { ConfigCard } from "../../components/config-card"

export function SelectionTranslationToggle() {
  const [selectionTranslation, setSelectionTranslation] = useAtom(
    configFieldsAtomMap.selectionTranslation,
  )

  return (
    <ConfigCard
      id="selection-translation-toggle"
      title={i18n.t("options.selectionTranslation.toggle.title")}
      description={i18n.t("options.selectionTranslation.toggle.description")}
    >
      <div className="w-full flex justify-end">
        <Switch
          checked={selectionTranslation.enabled}
          onCheckedChange={(checked) => {
            void setSelectionTranslation({ ...selectionTranslation, enabled: checked })
          }}
        />
      </div>
    </ConfigCard>
  )
}
