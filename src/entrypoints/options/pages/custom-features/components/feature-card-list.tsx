import type { SelectionToolbarCustomFeature } from "@/types/config/selection-toolbar"
import { i18n } from "#imports"
import { Icon } from "@iconify/react"
import { useAtom, useAtomValue } from "jotai"
import { useMemo } from "react"
import { Button } from "@/components/ui/base-ui/button"
import { Switch } from "@/components/ui/base-ui/switch"
import { isLLMProviderConfig } from "@/types/config/provider"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { createOutputSchemaField, DEFAULT_FEATURE_ICONS, DEFAULT_FEATURE_NAME } from "@/utils/constants/selection-toolbar-custom-feature"
import { cn } from "@/utils/styles/utils"
import { EntityListRail } from "../../../components/entity-list-rail"
import { selectedCustomFeatureIdAtom } from "../atoms"

export function CustomFeatureCardList() {
  const [selectionToolbarConfig, setSelectionToolbarConfig] = useAtom(configFieldsAtomMap.selectionToolbar)
  const [selectedCustomFeatureId, setSelectedCustomFeatureId] = useAtom(selectedCustomFeatureIdAtom)
  const providersConfig = useAtomValue(configFieldsAtomMap.providersConfig)

  const customFeatures = selectionToolbarConfig.customFeatures ?? []
  const llmProviders = useMemo(
    () => providersConfig.filter(provider => provider.enabled && isLLMProviderConfig(provider)),
    [providersConfig],
  )

  const handleAddFeature = () => {
    if (llmProviders.length === 0) {
      return
    }

    const existingFeatureNameSet = new Set(customFeatures.map(feature => feature.name))
    let featureName = DEFAULT_FEATURE_NAME
    for (let i = 0; i <= customFeatures.length; i++) {
      const currentFeatureName = i === 0 ? DEFAULT_FEATURE_NAME : `${DEFAULT_FEATURE_NAME} ${i}`
      if (!existingFeatureNameSet.has(currentFeatureName)) {
        featureName = currentFeatureName
        break
      }
    }

    const newFeature: SelectionToolbarCustomFeature = {
      id: crypto.randomUUID(),
      name: featureName,
      enabled: true,
      icon: DEFAULT_FEATURE_ICONS[customFeatures.length % DEFAULT_FEATURE_ICONS.length],
      providerId: llmProviders[0].id,
      systemPrompt: "",
      prompt: "",
      outputSchema: [createOutputSchemaField(i18n.t("options.floatingButtonAndToolbar.selectionToolbar.customFeatures.form.defaultFieldName"))],
    }

    void setSelectionToolbarConfig({
      ...selectionToolbarConfig,
      customFeatures: [...customFeatures, newFeature],
    })
    setSelectedCustomFeatureId(newFeature.id)
  }

  return (
    <div className="flex flex-col gap-4">
      <Button variant="outline" className="h-auto p-3 border-dashed rounded-xl" onClick={handleAddFeature} disabled={llmProviders.length === 0}>
        <div className="flex items-center justify-center gap-2 w-full">
          <Icon icon="tabler:plus" className="size-4" />
          <span className="text-sm">{i18n.t("options.floatingButtonAndToolbar.selectionToolbar.customFeatures.add")}</span>
        </div>
      </Button>

      {llmProviders.length === 0 && (
        <div className="text-sm text-amber-600 dark:text-amber-400">
          {i18n.t("options.floatingButtonAndToolbar.selectionToolbar.customFeatures.noEnabledLlmProvider")}
        </div>
      )}

      {customFeatures.length > 0 && (
        <EntityListRail>
          <div className="flex flex-col gap-3 pt-2">
            {customFeatures.map(feature => (
              <div
                key={feature.id}
                className={cn(
                  "rounded-xl border p-3 bg-card transition-colors cursor-pointer",
                  selectedCustomFeatureId === feature.id && "border-primary",
                  feature.enabled === false && "opacity-70",
                )}
                onClick={() => setSelectedCustomFeatureId(feature.id)}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="size-4">
                      <Icon icon={feature.icon} className="size-4 text-zinc-600 dark:text-zinc-300 shrink-0" />
                    </div>
                    <span className="text-sm font-medium truncate">{feature.name}</span>
                  </div>
                  <Switch
                    checked={feature.enabled !== false}
                    onCheckedChange={(checked) => {
                      void setSelectionToolbarConfig({
                        ...selectionToolbarConfig,
                        customFeatures: customFeatures.map(item =>
                          item.id === feature.id ? { ...item, enabled: checked } : item,
                        ),
                      })
                    }}
                    onPointerDown={event => event.stopPropagation()}
                    onClick={event => event.stopPropagation()}
                  />
                </div>
              </div>
            ))}
          </div>
        </EntityListRail>
      )}
    </div>
  )
}
