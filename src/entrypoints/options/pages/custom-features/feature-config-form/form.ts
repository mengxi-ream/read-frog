import { createFormHook, formOptions } from "@tanstack/react-form"
import { fieldContext, formContext } from "@/components/form/form-context"
import { InputField } from "@/components/form/input-field"
import { SelectField } from "@/components/form/select-field"
import { selectionToolbarCustomFeatureSchema } from "@/types/config/selection-toolbar"

export const { useAppForm, withForm } = createFormHook({
  fieldComponents: {
    InputField,
    SelectField,
  },
  formComponents: {},
  fieldContext,
  formContext,
})

export const formOpts = formOptions({
  validators: {
    onChange: selectionToolbarCustomFeatureSchema,
  },
})
