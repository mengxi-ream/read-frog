import type * as React from "react"
import { useStore } from "@tanstack/react-form"
import { useCallback } from "react"
import { Field, FieldLabel } from "@/components/ui/base-ui/field"
import { Select } from "@/components/ui/base-ui/select"
import { useFieldContext } from "../form-context"

type SelectFieldProps = React.ComponentProps<typeof Select> & {
  formForSubmit: { handleSubmit: () => void }
  label: React.ReactNode
}

export function SelectField(
  { formForSubmit, label, ...props }: SelectFieldProps,
) {
  const field = useFieldContext<string | undefined>()
  const errors = useStore(field.store, state => state.meta.errors)

  const handleValueChange = useCallback((value: unknown) => {
    if (typeof value !== "string")
      return
    field.handleChange(value)
    void formForSubmit.handleSubmit()
  }, [field, formForSubmit])

  return (
    <Field>
      <FieldLabel htmlFor={field.name}>
        {label}
      </FieldLabel>
      <Select
        value={field.state.value}
        onValueChange={handleValueChange}
        {...props}
      >
        {props.children}
      </Select>
      {errors.length > 0 && (
        <span className="text-sm font-normal text-destructive">
          {errors.map(error => typeof error === "string" ? error : error?.message).join(", ")}
        </span>
      )}
    </Field>
  )
}
