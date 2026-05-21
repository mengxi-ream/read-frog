import { i18n } from "#imports"
import { useAtom } from "jotai"
import { Switch } from "@/components/ui/base-ui/switch"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { ConfigCard } from "../../components/config-card"

export function SelectionTranslationAutoPronunciation() {
  const [selectionTranslation, setSelectionTranslation] = useAtom(
    configFieldsAtomMap.selectionTranslation,
  )

  return (
    <ConfigCard
      id="selection-translation-auto-pronunciation"
      title={i18n.t("options.selectionTranslation.autoPronunciation.title")}
      description={i18n.t("options.selectionTranslation.autoPronunciation.description")}
    >
      <div className="w-full flex justify-end">
        <Switch
          checked={selectionTranslation.autoPronunciation}
          onCheckedChange={(checked) => {
            void setSelectionTranslation({ ...selectionTranslation, autoPronunciation: checked })
          }}
        />
      </div>
    </ConfigCard>
  )
}
