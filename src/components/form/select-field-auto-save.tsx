import type * as React from "react"
import { useStore } from "@tanstack/react-form"
import { useCallback } from "react"
import { Field, FieldError, FieldLabel } from "@/components/ui/base-ui/field"
import { Select } from "@/components/ui/base-ui/select"
import { useFieldContext } from "./form-context"

type SelectFieldAutoSaveProps = React.ComponentProps<typeof Select> & {
  formForSubmit: { handleSubmit: () => void }
  label: React.ReactNode
  labelExtra?: React.ReactNode
}

export function SelectFieldAutoSave(
  { formForSubmit, label, labelExtra, ...props }: SelectFieldAutoSaveProps,
) {
  const field = useFieldContext<string | undefined>()
  const errors = useStore(field.store, state => state.meta.errors)
  const hasError = errors.length > 0

  const handleValueChange = useCallback((value: unknown) => {
    if (typeof value !== "string")
      return
    field.handleChange(value)
    void formForSubmit.handleSubmit()
  }, [field, formForSubmit])

  return (
    <Field invalid={hasError}>
      <div className="flex items-end justify-between w-full">
        <FieldLabel nativeLabel={false} render={<div />}>
          {label}
        </FieldLabel>
        {labelExtra}
      </div>
      <Select
        value={field.state.value}
        onValueChange={handleValueChange}
        {...props}
      >
        {props.children}
      </Select>
      <FieldError match={hasError}>
        {errors.map(error => typeof error === "string" ? error : error?.message).join(", ")}
      </FieldError>
    </Field>
  )
}
