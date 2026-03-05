import type { CustomFeatureTemplate } from "@/utils/constants/custom-feature-templates"
import { i18n } from "#imports"
import { Icon } from "@iconify/react"
import { useAtom, useAtomValue } from "jotai"
import { useMemo, useState } from "react"
import { Button } from "@/components/ui/base-ui/button"
import { Dialog, DialogTrigger } from "@/components/ui/base-ui/dialog"
import { Switch } from "@/components/ui/base-ui/switch"
import { isLLMProviderConfig } from "@/types/config/provider"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { DEFAULT_FEATURE_NAME } from "@/utils/constants/custom-feature"
import { getUniqueName } from "@/utils/name"
import { cn } from "@/utils/styles/utils"
import { EntityListRail } from "../../../components/entity-list-rail"
import { selectedCustomFeatureIdAtom } from "../atoms"
import { AddFeatureDialog } from "./add-feature-dialog"

export function CustomFeatureCardList() {
  const [selectionToolbarConfig, setSelectionToolbarConfig] = useAtom(configFieldsAtomMap.selectionToolbar)
  const [selectedCustomFeatureId, setSelectedCustomFeatureId] = useAtom(selectedCustomFeatureIdAtom)
  const providersConfig = useAtomValue(configFieldsAtomMap.providersConfig)
  const [dialogOpen, setDialogOpen] = useState(false)

  const customFeatures = selectionToolbarConfig.customFeatures ?? []
  const llmProviders = useMemo(
    () => providersConfig.filter(provider => provider.enabled && isLLMProviderConfig(provider)),
    [providersConfig],
  )

  const handleTemplateSelect = (template: CustomFeatureTemplate) => {
    if (llmProviders.length === 0)
      return

    const newFeature = template.createFeature(llmProviders[0].id)

    const existingNames = new Set(customFeatures.map(f => f.name))
    const baseName = template.id === "blank" ? DEFAULT_FEATURE_NAME : newFeature.name
    newFeature.name = getUniqueName(baseName, existingNames)

    void setSelectionToolbarConfig({
      ...selectionToolbarConfig,
      customFeatures: [...customFeatures, newFeature],
    })
    setSelectedCustomFeatureId(newFeature.id)
    setDialogOpen(false)
  }

  return (
    <div className="flex flex-col gap-4">
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger
          render={(
            <Button variant="outline" className="h-auto p-3 border-dashed rounded-xl" disabled={llmProviders.length === 0}>
              <div className="flex items-center justify-center gap-2 w-full">
                <Icon icon="tabler:plus" className="size-4" />
                <span className="text-sm">{i18n.t("options.floatingButtonAndToolbar.selectionToolbar.customFeatures.add")}</span>
              </div>
            </Button>
          )}
        />
        <AddFeatureDialog onSelect={handleTemplateSelect} />
      </Dialog>

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
