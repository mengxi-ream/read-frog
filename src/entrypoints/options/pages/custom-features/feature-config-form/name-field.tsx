import type { SelectionToolbarCustomFeature } from "@/types/config/selection-toolbar"
import { i18n } from "#imports"
import { useAtomValue } from "jotai"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { selectedCustomFeatureIdAtom } from "../atoms"
import { withForm } from "./form"

export const NameField = withForm({
  ...{ defaultValues: {} as SelectionToolbarCustomFeature },
  render: function Render({ form }) {
    const selectionToolbarConfig = useAtomValue(configFieldsAtomMap.selectionToolbar)
    const selectedFeatureId = useAtomValue(selectedCustomFeatureIdAtom)
    const customFeatures = selectionToolbarConfig.customFeatures ?? []

    return (
      <form.AppField
        name="name"
        validators={{
          onChange: ({ value }) => {
            if (!value.trim()) {
              return i18n.t("options.floatingButtonAndToolbar.selectionToolbar.customFeatures.errors.nameRequired")
            }
            const duplicate = customFeatures.find(f =>
              f.name === value && f.id !== selectedFeatureId,
            )
            if (duplicate) {
              return i18n.t("options.floatingButtonAndToolbar.selectionToolbar.customFeatures.errors.duplicateName", [value])
            }
            return undefined
          },
        }}
      >
        {field => <field.InputField formForSubmit={form} label={i18n.t("options.floatingButtonAndToolbar.selectionToolbar.customFeatures.form.name")} />}
      </form.AppField>
    )
  },
})
