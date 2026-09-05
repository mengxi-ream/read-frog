import type { SelectionToolbarCustomAction } from "@/types/config/selection-toolbar"
import { dequal } from "dequal"
import { useAtomValue } from "jotai"
import { useState } from "react"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { BUILT_IN_DICTIONARY_ACTION_ID } from "@/utils/constants/custom-action"
import { findSelectionToolbarAction } from "@/utils/custom-actions"
import { i18n } from "@/utils/i18n"
import { EntityEditor } from "../../../components/entity-editor"
import { selectedCustomActionIdAtom } from "../atoms"
import { ActionEditor, BuiltInActionEditor, CustomActionEditor } from "./action-editor"

export function CustomActionConfigForm() {
  const selectionToolbarConfig = useAtomValue(configFieldsAtomMap.selectionToolbar)
  const selectedCustomActionId = useAtomValue(selectedCustomActionIdAtom)
  const currentAction = selectedCustomActionId
    ? findSelectionToolbarAction(selectionToolbarConfig, selectedCustomActionId)
    : undefined

  const [lastAction, setLastAction] = useState<SelectionToolbarCustomAction | undefined>(undefined)
  if (currentAction && !dequal(currentAction, lastAction)) setLastAction(currentAction)
  const selectedAction =
    currentAction ?? (lastAction?.id === selectedCustomActionId ? lastAction : undefined)
  if (!selectedAction) {
    return (
      <EntityEditor.Empty>
        {selectionToolbarConfig.customActions.length === 0
          ? i18n.t("options.selectionToolbar.customActions.empty")
          : i18n.t("options.selectionToolbar.customActions.edit")}
      </EntityEditor.Empty>
    )
  }

  if (selectedAction.id === BUILT_IN_DICTIONARY_ACTION_ID) {
    return <BuiltInDictionaryEditor key={selectedAction.id} action={selectedAction} />
  }

  // Force remount per action to avoid transient undefined field states during selection switches.
  return <EditableActionEditor key={selectedAction.id} action={selectedAction} />
}

function BuiltInDictionaryEditor({ action }: { action: SelectionToolbarCustomAction }) {
  return (
    <BuiltInActionEditor.Provider action={action}>
      <ActionEditor.Form>
        <EntityEditor.Root>
          <EntityEditor.Body>
            <ActionEditor.NameField readOnly>
              <ActionEditor.CustomizeButton />
            </ActionEditor.NameField>
            <ActionEditor.IconField readOnly />
            <ActionEditor.ProviderField />
            <ActionEditor.SystemPromptField readOnly />
            <ActionEditor.PromptField readOnly />
            <ActionEditor.OutputSchema.ReadOnly />
            <ActionEditor.NotebaseConnectionField />
          </EntityEditor.Body>
        </EntityEditor.Root>
      </ActionEditor.Form>
    </BuiltInActionEditor.Provider>
  )
}

function EditableActionEditor({ action }: { action: SelectionToolbarCustomAction }) {
  return (
    <CustomActionEditor.Provider action={action}>
      <ActionEditor.Form>
        <EntityEditor.Root>
          <EntityEditor.Body>
            <ActionEditor.NameField />
            <ActionEditor.IconField />
            <ActionEditor.ProviderField />
            <ActionEditor.SystemPromptField />
            <ActionEditor.PromptField />
            <ActionEditor.OutputSchema.Editable />
            <ActionEditor.NotebaseConnectionField />
          </EntityEditor.Body>
          <EntityEditor.Footer>
            <ActionEditor.DuplicateButton />
            <ActionEditor.DeleteButton />
          </EntityEditor.Footer>
        </EntityEditor.Root>
      </ActionEditor.Form>
    </CustomActionEditor.Provider>
  )
}
