import type { SelectionToolbarCustomFeature } from "@/types/config/selection-toolbar"
import { i18n } from "#imports"
import { useAtom, useAtomValue } from "jotai"
import { useEffect, useState } from "react"
import { QuickInsertableTextareaField } from "@/components/form/quick-insertable-textarea-field"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/base-ui/alert-dialog"
import { Button } from "@/components/ui/base-ui/button"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import {
  getSelectionToolbarCustomFeatureTokenCellText,
  SELECTION_TOOLBAR_CUSTOM_FEATURE_TOKENS,
} from "@/utils/constants/selection-toolbar-custom-feature"
import { cn } from "@/utils/styles/utils"
import { selectedCustomFeatureIdAtom } from "../atoms"
import { formOpts, useAppForm } from "./form"
import { IconField } from "./icon-field"
import { NameField } from "./name-field"
import { OutputSchemaField } from "./output-schema-field"
import { ProviderField } from "./provider-field"

export function CustomFeatureConfigForm() {
  const selectionToolbarConfig = useAtomValue(configFieldsAtomMap.selectionToolbar)
  const [selectedCustomFeatureId] = useAtom(selectedCustomFeatureIdAtom)

  const customFeatures = selectionToolbarConfig.customFeatures ?? []
  const selectedFeature = customFeatures.find(feature => feature.id === selectedCustomFeatureId)

  if (!selectedFeature) {
    return (
      <div className="flex-1 bg-card rounded-xl p-4 border min-h-[420px] flex items-center justify-center text-sm text-muted-foreground">
        {customFeatures.length === 0
          ? i18n.t("options.floatingButtonAndToolbar.selectionToolbar.customFeatures.empty")
          : i18n.t("options.floatingButtonAndToolbar.selectionToolbar.customFeatures.edit")}
      </div>
    )
  }

  // Force remount per feature to avoid transient undefined field states during selection switches.
  return <CustomFeatureConfigEditor key={selectedFeature.id} selectedFeature={selectedFeature} />
}

function CustomFeatureConfigEditor({ selectedFeature }: { selectedFeature: SelectionToolbarCustomFeature }) {
  const [selectionToolbarConfig, setSelectionToolbarConfig] = useAtom(configFieldsAtomMap.selectionToolbar)
  const [, setSelectedCustomFeatureId] = useAtom(selectedCustomFeatureIdAtom)

  const customFeatures = selectionToolbarConfig.customFeatures ?? []

  const form = useAppForm({
    ...formOpts,
    defaultValues: selectedFeature,
    onSubmit: async ({ value }) => {
      const updatedCustomFeatures = customFeatures.map(feature =>
        feature.id === selectedFeature.id ? value : feature,
      )

      await setSelectionToolbarConfig({
        ...selectionToolbarConfig,
        customFeatures: updatedCustomFeatures,
      })
    },
  })

  useEffect(() => {
    form.reset(selectedFeature)
  }, [selectedFeature, form])

  const customFeatureInsertCells = SELECTION_TOOLBAR_CUSTOM_FEATURE_TOKENS.map(token => ({
    text: getSelectionToolbarCustomFeatureTokenCellText(token),
    description: i18n.t(`options.floatingButtonAndToolbar.selectionToolbar.customFeatures.form.tokens.${token}`),
  }))

  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  const handleDeleteFeature = () => {
    const currentIndex = customFeatures.findIndex(feature => feature.id === selectedFeature.id)
    if (currentIndex < 0) {
      return
    }

    const updatedCustomFeatures = customFeatures.filter(feature => feature.id !== selectedFeature.id)
    const nextSelectedFeature = updatedCustomFeatures[currentIndex] ?? updatedCustomFeatures[currentIndex - 1]

    void setSelectionToolbarConfig({
      ...selectionToolbarConfig,
      customFeatures: updatedCustomFeatures,
    })
    setSelectedCustomFeatureId(nextSelectedFeature?.id)
  }

  return (
    <form.AppForm>
      <div className={cn("flex-1 bg-card rounded-xl p-4 border flex flex-col justify-between")}>
        <div className="flex flex-col gap-4">
          <NameField form={form} />

          <IconField form={form} />

          <ProviderField form={form} />

          <form.AppField name="systemPrompt">
            {() => (
              <QuickInsertableTextareaField
                formForSubmit={form}
                label={i18n.t("options.floatingButtonAndToolbar.selectionToolbar.customFeatures.form.systemPrompt")}
                className="min-h-36 max-h-80"
                insertCells={customFeatureInsertCells}
              />
            )}
          </form.AppField>

          <form.AppField name="prompt">
            {() => (
              <QuickInsertableTextareaField
                formForSubmit={form}
                label={i18n.t("options.floatingButtonAndToolbar.selectionToolbar.customFeatures.form.prompt")}
                className="min-h-28 max-h-80"
                insertCells={customFeatureInsertCells}
              />
            )}
          </form.AppField>

          <OutputSchemaField form={form} />
        </div>
        <div className="flex justify-end mt-8">
          <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
            <AlertDialogTrigger render={<Button type="button" variant="destructive" />}>
              {i18n.t("options.floatingButtonAndToolbar.selectionToolbar.customFeatures.form.delete")}
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{i18n.t("options.floatingButtonAndToolbar.selectionToolbar.customFeatures.form.deleteDialog.title")}</AlertDialogTitle>
                <AlertDialogDescription>{i18n.t("options.floatingButtonAndToolbar.selectionToolbar.customFeatures.form.deleteDialog.description")}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{i18n.t("options.floatingButtonAndToolbar.selectionToolbar.customFeatures.form.deleteDialog.cancel")}</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={handleDeleteFeature}>{i18n.t("options.floatingButtonAndToolbar.selectionToolbar.customFeatures.form.deleteDialog.confirm")}</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </form.AppForm>
  )
}
