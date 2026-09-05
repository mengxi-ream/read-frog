import type { SelectionToolbarCustomAction } from "@/types/config/selection-toolbar"
import { useAtomValue } from "jotai"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { i18n } from "@/utils/i18n"
import { selectedCustomActionIdAtom } from "../atoms"
import { withForm } from "./form"

export const NameField = withForm({
  ...{ defaultValues: {} as SelectionToolbarCustomAction },
  props: {
    readOnly: false as boolean,
    labelExtra: undefined as React.ReactNode,
  },
  render: function Render({ form, readOnly, labelExtra }) {
    const selectionToolbarConfig = useAtomValue(configFieldsAtomMap.selectionToolbar)
    const selectedActionId = useAtomValue(selectedCustomActionIdAtom)
    const customActions = selectionToolbarConfig.customActions ?? []

    return (
      <form.AppField
        name="name"
        validators={{
          onChange: ({ value }) => {
            if (!value.trim()) {
              return i18n.t("options.selectionToolbar.customActions.errors.nameRequired")
            }
            const duplicate = customActions.find(
              (action) => action.name === value && action.id !== selectedActionId,
            )
            if (duplicate) {
              return i18n.t("options.selectionToolbar.customActions.errors.duplicateName", [value])
            }
            return undefined
          },
        }}
      >
        {(field) => (
          <field.InputFieldAutoSave
            label={i18n.t("options.selectionToolbar.customActions.form.name")}
            labelExtra={labelExtra}
            readOnly={readOnly}
          />
        )}
      </form.AppField>
    )
  },
})
