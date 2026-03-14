import type { SelectionToolbarCustomAction } from "@/types/config/selection-toolbar"
import { i18n } from "#imports"
import { useAtomValue } from "jotai"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { selectedCustomActionIdAtom } from "../atoms"
import { withForm } from "./form"

export const NameField = withForm({
  ...{ defaultValues: {} as SelectionToolbarCustomAction },
  render: function Render({ form }) {
    const selectionToolbarConfig = useAtomValue(configFieldsAtomMap.selectionToolbar)
    const selectedActionId = useAtomValue(selectedCustomActionIdAtom)
    const customActions = selectionToolbarConfig.customActions ?? []

    return (
      <form.AppField
        name="name"
        validators={{
          onChange: ({ value }) => {
            if (!value.trim()) {
              return i18n.t("options.floatingButtonAndToolbar.selectionToolbar.customActions.errors.nameRequired")
            }
            const duplicate = customActions.find(action =>
              action.name === value && action.id !== selectedActionId,
            )
            if (duplicate) {
              return i18n.t("options.floatingButtonAndToolbar.selectionToolbar.customActions.errors.duplicateName", [value])
            }
            return undefined
          },
        }}
      >
        {field => <field.InputFieldAutoSave formForSubmit={form} label={i18n.t("options.floatingButtonAndToolbar.selectionToolbar.customActions.form.name")} />}
      </form.AppField>
    )
  },
})
