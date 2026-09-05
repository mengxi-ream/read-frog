import type { AutosaveController } from "@/components/form/autosave-controller"
import type { SelectionToolbarCustomAction } from "@/types/config/selection-toolbar"
import { useAtom, useSetAtom, useStore } from "jotai"
import { createContext, use, useEffect, useState } from "react"
import {
  AutosaveBoundary,
  requestEditorNavigationAtom,
  activeAutosaveAtom,
} from "@/components/form/autosave-navigation"
import { QuickInsertableTextareaFieldAutoSave } from "@/components/form/quick-insertable-textarea-field-auto-save"
import { toAutosaveSession, useAutosave } from "@/components/form/use-autosave"
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/base-ui/tooltip"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { patchActionConfigAtom } from "@/utils/atoms/entity-config"
import {
  BUILT_IN_DICTIONARY_ACTION_ID,
  getSelectionToolbarCustomActionTokenCellText,
  SELECTION_TOOLBAR_CUSTOM_ACTION_TOKENS,
} from "@/utils/constants/custom-action"
import { duplicateSelectionToolbarAction, getSelectionToolbarActions } from "@/utils/custom-actions"
import { i18n } from "@/utils/i18n"
import { selectedCustomActionIdAtom } from "../atoms"
import { formOpts, useAppForm } from "./form"
import { IconField as IconFormField } from "./icon-field"
import { NameField as NameFormField } from "./name-field"
import { NotebaseConnectionField as NotebaseConnectionFormField } from "./notebase-connection-field"
import {
  OutputSchemaField as EditableOutputSchemaFormField,
  ReadOnlyOutputSchemaField,
} from "./output-schema-field"
import { ProviderField as ProviderFormField } from "./provider-field"

function useActionForm(
  action: SelectionToolbarCustomAction,
  save: (
    nextAction: SelectionToolbarCustomAction,
    changes: Partial<SelectionToolbarCustomAction>,
  ) => Promise<void>,
) {
  const form = useAppForm({
    ...formOpts,
    defaultValues: action,
    onSubmitMeta: { revision: 0 },
    onSubmit: async ({ value, meta }) => {
      await autosave.commit(value, meta.revision)
    },
  })
  const autosave: AutosaveController<SelectionToolbarCustomAction> = useAutosave({
    initialValue: action,
    getDraft: () => form.state.values,
    setField: (key, value) =>
      form.setFieldValue(key, value as never, { dontUpdateMeta: true, dontRunListeners: true }),
    reset: (value) => form.reset(value),
    submit: (revision) => form.handleSubmit({ revision }),
    persist: save,
  })
  return { form, autosave }
}

type ActionForm = ReturnType<typeof useActionForm>["form"]

interface ActionEditorContextValue {
  state: {
    action: SelectionToolbarCustomAction
    allActions: SelectionToolbarCustomAction[]
    form: ActionForm
    autosave: AutosaveController<SelectionToolbarCustomAction>
  }
  actions: {
    submit: () => Promise<void>
    duplicate: () => Promise<void>
    delete?: () => Promise<void>
  }
}

const ActionEditorContext = createContext<ActionEditorContextValue | null>(null)

export function useActionEditor() {
  const context = use(ActionEditorContext)
  if (!context) {
    throw new Error("ActionEditor components must be rendered inside an ActionEditor Provider")
  }
  return context
}

function useRequiredActionEditorCommand(command: "delete") {
  const action = useActionEditor().actions[command]
  if (!action) {
    throw new Error(`ActionEditor.${command} is unavailable in this composition`)
  }
  return action
}

function useActionEditorController(
  action: SelectionToolbarCustomAction,
  deleteAction?: () => Promise<void>,
): ActionEditorContextValue {
  const store = useStore()
  const requestNavigation = useSetAtom(requestEditorNavigationAtom)
  const [selectionToolbar, setSelectionToolbar] = useAtom(configFieldsAtomMap.selectionToolbar)
  const setSelectedActionId = useSetAtom(selectedCustomActionIdAtom)

  const patchAction = useSetAtom(patchActionConfigAtom)
  const { form, autosave } = useActionForm(action, async (_snapshot, changes) => {
    await patchAction({ id: action.id, changes })
  })

  useEffect(() => {
    autosave.reconcile(
      getSelectionToolbarActions(selectionToolbar).find((item) => item.id === action.id),
    )
  }, [action.id, selectionToolbar, autosave])

  const allActions = getSelectionToolbarActions(selectionToolbar)

  return {
    state: {
      action,
      allActions,
      form,
      autosave,
    },
    actions: {
      submit: async () => {
        await autosave.flush()
      },
      duplicate: async () => {
        await requestNavigation(async () => {
          const current = store.get(configFieldsAtomMap.selectionToolbar)
          const currentActions = getSelectionToolbarActions(current)
          const source = currentActions.find((item) => item.id === action.id)
          if (!source) return
          const duplicatedAction = duplicateSelectionToolbarAction(source, currentActions)
          await setSelectionToolbar((latest) => ({
            ...latest,
            customActions: [...latest.customActions, duplicatedAction],
          }))
          await setSelectedActionId(duplicatedAction.id)
        })
      },
      ...(deleteAction ? { delete: deleteAction } : {}),
    },
  }
}

function BuiltInProvider({
  action,
  children,
}: {
  action: SelectionToolbarCustomAction
  children: React.ReactNode
}) {
  const value = useActionEditorController(action)
  return (
    <AutosaveBoundary session={toAutosaveSession(value.state.autosave)}>
      <ActionEditorContext value={value}>{children}</ActionEditorContext>
    </AutosaveBoundary>
  )
}

function CustomProvider({
  action,
  children,
}: {
  action: SelectionToolbarCustomAction
  children: React.ReactNode
}) {
  const store = useStore()
  const setSelectionToolbar = useSetAtom(configFieldsAtomMap.selectionToolbar)
  const setSelectedActionId = useSetAtom(selectedCustomActionIdAtom)

  const deleteAction = async () => {
    await store.get(activeAutosaveAtom)?.discard()
    const selectionToolbar = store.get(configFieldsAtomMap.selectionToolbar)
    const currentIndex = selectionToolbar.customActions.findIndex((item) => item.id === action.id)
    if (currentIndex < 0) {
      return
    }

    const updatedActions = selectionToolbar.customActions.filter((item) => item.id !== action.id)
    const nextSelectedAction = updatedActions[currentIndex] ?? updatedActions[currentIndex - 1]

    await setSelectionToolbar({
      ...selectionToolbar,
      customActions: updatedActions,
      noteSuggestion:
        selectionToolbar.noteSuggestion.actionId === action.id
          ? {
              ...selectionToolbar.noteSuggestion,
              actionId: BUILT_IN_DICTIONARY_ACTION_ID,
            }
          : selectionToolbar.noteSuggestion,
    })
    await setSelectedActionId(nextSelectedAction?.id)
  }

  const value = useActionEditorController(action, deleteAction)
  return (
    <AutosaveBoundary session={toAutosaveSession(value.state.autosave)}>
      <ActionEditorContext value={value}>{children}</ActionEditorContext>
    </AutosaveBoundary>
  )
}

function Form({ children }: { children: React.ReactNode }) {
  const { form } = useActionEditor().state
  return <form.AppForm>{children}</form.AppForm>
}

function NameField({
  readOnly = false,
  children,
}: {
  readOnly?: boolean
  children?: React.ReactNode
}) {
  const { form } = useActionEditor().state
  return <NameFormField form={form} readOnly={readOnly} labelExtra={children} />
}

function IconField({ readOnly = false }: { readOnly?: boolean }) {
  const { form } = useActionEditor().state
  return <IconFormField form={form} readOnly={readOnly} />
}

function ProviderField() {
  const { form } = useActionEditor().state
  return <ProviderFormField form={form} />
}

function getActionInsertCells() {
  return SELECTION_TOOLBAR_CUSTOM_ACTION_TOKENS.map((token) => ({
    text: getSelectionToolbarCustomActionTokenCellText(token),
    description: i18n.t(`options.selectionToolbar.customActions.form.tokens.${token}`),
  }))
}

function SystemPromptField({ readOnly }: { readOnly?: boolean }) {
  const { form } = useActionEditor().state
  return (
    <form.AppField name="systemPrompt">
      {() => (
        <QuickInsertableTextareaFieldAutoSave
          label={i18n.t("options.selectionToolbar.customActions.form.systemPrompt")}
          className="max-h-80 min-h-36"
          insertCells={getActionInsertCells()}
          readOnly={readOnly}
        />
      )}
    </form.AppField>
  )
}

function PromptField({ readOnly }: { readOnly?: boolean }) {
  const { form } = useActionEditor().state
  return (
    <form.AppField name="prompt">
      {() => (
        <QuickInsertableTextareaFieldAutoSave
          label={i18n.t("options.selectionToolbar.customActions.form.prompt")}
          className="max-h-80 min-h-28"
          insertCells={getActionInsertCells()}
          readOnly={readOnly}
        />
      )}
    </form.AppField>
  )
}

function EditableOutputSchema() {
  const { form } = useActionEditor().state
  return <EditableOutputSchemaFormField form={form} />
}

function ReadOnlyOutputSchema() {
  const { action } = useActionEditor().state
  return <ReadOnlyOutputSchemaField outputSchema={action.outputSchema} />
}

function NotebaseConnectionField() {
  const { form } = useActionEditor().state
  return <NotebaseConnectionFormField form={form} />
}

function DuplicateButton() {
  const { duplicate } = useActionEditor().actions
  return (
    <Button type="button" variant="outline" size="sm" onClick={() => void duplicate()}>
      {i18n.t("options.apiProviders.form.duplicate")}
    </Button>
  )
}

function CustomizeButton() {
  const { duplicate } = useActionEditor().actions

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="brand-outline"
            size="xs"
            onClick={() => void duplicate()}
          />
        }
      >
        {i18n.t("options.selectionToolbar.customActions.form.customize")}
      </TooltipTrigger>
      <TooltipContent className="max-w-72">
        {i18n.t("options.selectionToolbar.customActions.form.customizeTooltip")}
      </TooltipContent>
    </Tooltip>
  )
}

function DeleteButton() {
  const deleteAction = useRequiredActionEditorCommand("delete")
  const [open, setOpen] = useState(false)

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger render={<Button type="button" variant="destructive" size="sm" />}>
        {i18n.t("options.selectionToolbar.customActions.form.delete")}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {i18n.t("options.selectionToolbar.customActions.form.deleteDialog.title")}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {i18n.t("options.selectionToolbar.customActions.form.deleteDialog.description")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>
            {i18n.t("options.selectionToolbar.customActions.form.deleteDialog.cancel")}
          </AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={() => void deleteAction()}>
            {i18n.t("options.selectionToolbar.customActions.form.deleteDialog.confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export const ActionEditor = {
  Form,
  NameField,
  IconField,
  ProviderField,
  SystemPromptField,
  PromptField,
  OutputSchema: {
    Editable: EditableOutputSchema,
    ReadOnly: ReadOnlyOutputSchema,
  },
  NotebaseConnectionField,
  CustomizeButton,
  DuplicateButton,
  DeleteButton,
}

export const BuiltInActionEditor = {
  Provider: BuiltInProvider,
}

export const CustomActionEditor = {
  Provider: CustomProvider,
}
