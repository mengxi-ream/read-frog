import { i18n } from "#imports"
import { RiTranslate } from "@remixicon/react"
import { IconVolume, IconZoomScan } from "@tabler/icons-react"
import { useAtom } from "jotai"
import { Switch } from "@/components/ui/base-ui/switch"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { ConfigCard } from "../../components/config-card"

export function SelectionToolbarFeatureToggles() {
  const isFirefox = import.meta.env.BROWSER === "firefox"
  const [selectionToolbar, setSelectionToolbar] = useAtom(
    configFieldsAtomMap.selectionToolbar,
  )

  const { features } = selectionToolbar

  const setFeatureEnabled = (
    key: "translate" | "speak" | "vocabularyInsight",
    enabled: boolean,
  ) => {
    void setSelectionToolbar({
      ...selectionToolbar,
      features: {
        ...features,
        [key]: { ...features[key], enabled },
      },
    })
  }

  return (
    <ConfigCard
      id="selection-toolbar-feature-toggles"
      title={i18n.t("options.floatingButtonAndToolbar.selectionToolbar.featureToggles.title")}
      description={i18n.t("options.floatingButtonAndToolbar.selectionToolbar.featureToggles.description")}
    >
      <div className="w-full flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm">
            <RiTranslate className="size-4 text-muted-foreground" />
            {i18n.t("options.floatingButtonAndToolbar.selectionToolbar.featureToggles.translate")}
          </span>
          <Switch
            checked={features.translate.enabled}
            onCheckedChange={checked => setFeatureEnabled("translate", checked)}
          />
        </div>
        {!isFirefox && (
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm">
              <IconVolume className="size-4 text-muted-foreground" />
              {i18n.t("options.floatingButtonAndToolbar.selectionToolbar.featureToggles.speak")}
            </span>
            <Switch
              checked={features.speak.enabled}
              onCheckedChange={checked => setFeatureEnabled("speak", checked)}
            />
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm">
            <IconZoomScan className="size-4 text-muted-foreground" />
            {i18n.t("options.floatingButtonAndToolbar.selectionToolbar.featureToggles.vocabularyInsight")}
          </span>
          <Switch
            checked={features.vocabularyInsight.enabled}
            onCheckedChange={checked => setFeatureEnabled("vocabularyInsight", checked)}
          />
        </div>
      </div>
    </ConfigCard>
  )
}
