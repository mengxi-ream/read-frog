import { createFormHook, formOptions } from "@tanstack/react-form"
import { fieldContext, formContext } from "@/components/form/form-context"
import { InputFieldAutoSave } from "@/components/form/input-field-auto-save"
import { SelectFieldAutoSave } from "@/components/form/select-field-auto-save"
import { apiProviderConfigItemSchema } from "@/types/config/provider"

export const { useAppForm, withForm } = createFormHook({
  fieldComponents: {
    InputFieldAutoSave,
    SelectFieldAutoSave,
  },
  formComponents: {},
  fieldContext,
  formContext,
})

export const formOpts = formOptions({
  validators: {
    onChange: apiProviderConfigItemSchema,
  },
})
