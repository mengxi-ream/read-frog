import type { SelectionToolbarCustomAction } from "@/types/config/selection-toolbar"
import { useAtom, useSetAtom } from "jotai"
import { createContext, use, useEffect, useState } from "react"
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/base-ui/tooltip"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import {
  BUILT_IN_DICTIONARY_ACTION_ID,
  getSelectionToolbarCustomActionTokenCellText,
  SELECTION_TOOLBAR_CUSTOM_ACTION_TOKENS,
} from "@/utils/constants/custom-action"
import {
  duplicateSelectionToolbarAction,
  getSelectionToolbarActions,
  replaceSelectionToolbarAction,
} from "@/utils/custom-actions"
import { i18n } from "@/utils/i18n"
import { sanitizeSelectionToolbarCustomAction } from "@/utils/notebase/connection"
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
  save: (nextAction: SelectionToolbarCustomAction) => Promise<void>,
) {
  return useAppForm({
    ...formOpts,
    defaultValues: action,
    onSubmit: async ({ value }) => {
      await save(sanitizeSelectionToolbarCustomAction(value))
    },
  })
}

type ActionForm = ReturnType<typeof useActionForm>

interface ActionEditorContextValue {
  state: {
    action: SelectionToolbarCustomAction
    allActions: SelectionToolbarCustomAction[]
    form: ActionForm
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
  const [selectionToolbar, setSelectionToolbar] = useAtom(configFieldsAtomMap.selectionToolbar)
  const setSelectedActionId = useSetAtom(selectedCustomActionIdAtom)

  const form = useActionForm(action, async (nextAction) => {
    await setSelectionToolbar(replaceSelectionToolbarAction(selectionToolbar, nextAction))
  })

  useEffect(() => {
    form.reset(action)
  }, [action, form])

  const allActions = getSelectionToolbarActions(selectionToolbar)

  return {
    state: {
      action,
      allActions,
      form,
    },
    actions: {
      submit: async () => {
        await form.handleSubmit()
      },
      duplicate: async () => {
        const duplicatedAction = duplicateSelectionToolbarAction(action, allActions)
        await setSelectionToolbar({
          ...selectionToolbar,
          customActions: [...selectionToolbar.customActions, duplicatedAction],
        })
        setSelectedActionId(duplicatedAction.id)
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
  return <ActionEditorContext value={value}>{children}</ActionEditorContext>
}

function CustomProvider({
  action,
  children,
}: {
  action: SelectionToolbarCustomAction
  children: React.ReactNode
}) {
  const [selectionToolbar, setSelectionToolbar] = useAtom(configFieldsAtomMap.selectionToolbar)
  const setSelectedActionId = useSetAtom(selectedCustomActionIdAtom)

  const deleteAction = async () => {
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
    setSelectedActionId(nextSelectedAction?.id)
  }

  const value = useActionEditorController(action, deleteAction)
  return <ActionEditorContext value={value}>{children}</ActionEditorContext>
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
          formForSubmit={form}
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
          formForSubmit={form}
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
