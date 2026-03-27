import type { SelectionToolbarCustomAction } from "@/types/config/selection-toolbar"
import { i18n } from "#imports"
import { useAtom, useAtomValue } from "jotai"
import { useEffect, useState } from "react"
import { QuickInsertableTextareaFieldAutoSave } from "@/components/form/quick-insertable-textarea-field-auto-save"
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
  getSelectionToolbarCustomActionTokenCellText,
  SELECTION_TOOLBAR_CUSTOM_ACTION_TOKENS,
} from "@/utils/constants/custom-action"
import { sanitizeSelectionToolbarCustomAction } from "@/utils/notebase"
import { cn } from "@/utils/styles/utils"
import { selectedCustomActionIdAtom } from "../atoms"
import { formOpts, useAppForm } from "./form"
import { IconField } from "./icon-field"
import { NameField } from "./name-field"
import { NotebaseConnectionField } from "./notebase-connection-field"
import { OutputSchemaField } from "./output-schema-field"
import { ProviderField } from "./provider-field"

export function CustomActionConfigForm() {
  const selectionToolbarConfig = useAtomValue(configFieldsAtomMap.selectionToolbar)
  const [selectedCustomActionId] = useAtom(selectedCustomActionIdAtom)

  const customActions = selectionToolbarConfig.customActions ?? []
  const selectedAction = customActions.find(action => action.id === selectedCustomActionId)

  if (!selectedAction) {
    return (
      <div className="flex-1 bg-card rounded-xl p-4 border min-h-[420px] flex items-center justify-center text-sm text-muted-foreground">
        {customActions.length === 0
          ? i18n.t("options.floatingButtonAndToolbar.selectionToolbar.customActions.empty")
          : i18n.t("options.floatingButtonAndToolbar.selectionToolbar.customActions.edit")}
      </div>
    )
  }

  // Force remount per action to avoid transient undefined field states during selection switches.
  return <CustomActionConfigEditor key={selectedAction.id} selectedAction={selectedAction} />
}

function CustomActionConfigEditor({ selectedAction }: { selectedAction: SelectionToolbarCustomAction }) {
  const [selectionToolbarConfig, setSelectionToolbarConfig] = useAtom(configFieldsAtomMap.selectionToolbar)
  const betaExperienceConfig = useAtomValue(configFieldsAtomMap.betaExperience)
  const [, setSelectedCustomActionId] = useAtom(selectedCustomActionIdAtom)

  const customActions = selectionToolbarConfig.customActions ?? []

  const form = useAppForm({
    ...formOpts,
    defaultValues: selectedAction,
    onSubmit: async ({ value }) => {
      const nextValue = sanitizeSelectionToolbarCustomAction(value)
      const updatedCustomActions = customActions.map(action =>
        action.id === selectedAction.id ? nextValue : action,
      )

      await setSelectionToolbarConfig({
        ...selectionToolbarConfig,
        customActions: updatedCustomActions,
      })
    },
  })

  useEffect(() => {
    form.reset(selectedAction)
  }, [selectedAction, form])

  const customActionInsertCells = SELECTION_TOOLBAR_CUSTOM_ACTION_TOKENS.map(token => ({
    text: getSelectionToolbarCustomActionTokenCellText(token),
    description: i18n.t(`options.floatingButtonAndToolbar.selectionToolbar.customActions.form.tokens.${token}`),
  }))

  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  const handleDeleteAction = () => {
    const currentIndex = customActions.findIndex(action => action.id === selectedAction.id)
    if (currentIndex < 0) {
      return
    }

    const updatedCustomActions = customActions.filter(action => action.id !== selectedAction.id)
    const nextSelectedAction = updatedCustomActions[currentIndex] ?? updatedCustomActions[currentIndex - 1]

    void setSelectionToolbarConfig({
      ...selectionToolbarConfig,
      customActions: updatedCustomActions,
    })
    setSelectedCustomActionId(nextSelectedAction?.id)
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
              <QuickInsertableTextareaFieldAutoSave
                formForSubmit={form}
                label={i18n.t("options.floatingButtonAndToolbar.selectionToolbar.customActions.form.systemPrompt")}
                className="min-h-36 max-h-80"
                insertCells={customActionInsertCells}
              />
            )}
          </form.AppField>

          <form.AppField name="prompt">
            {() => (
              <QuickInsertableTextareaFieldAutoSave
                formForSubmit={form}
                label={i18n.t("options.floatingButtonAndToolbar.selectionToolbar.customActions.form.prompt")}
                className="min-h-28 max-h-80"
                insertCells={customActionInsertCells}
              />
            )}
          </form.AppField>

          <OutputSchemaField form={form} />

          {betaExperienceConfig.enabled && <NotebaseConnectionField form={form} />}
        </div>
        <div className="flex justify-end mt-8">
          <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
            <AlertDialogTrigger render={<Button type="button" variant="destructive" />}>
              {i18n.t("options.floatingButtonAndToolbar.selectionToolbar.customActions.form.delete")}
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{i18n.t("options.floatingButtonAndToolbar.selectionToolbar.customActions.form.deleteDialog.title")}</AlertDialogTitle>
                <AlertDialogDescription>{i18n.t("options.floatingButtonAndToolbar.selectionToolbar.customActions.form.deleteDialog.description")}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{i18n.t("options.floatingButtonAndToolbar.selectionToolbar.customActions.form.deleteDialog.cancel")}</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={handleDeleteAction}>{i18n.t("options.floatingButtonAndToolbar.selectionToolbar.customActions.form.deleteDialog.confirm")}</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </form.AppForm>
  )
}
