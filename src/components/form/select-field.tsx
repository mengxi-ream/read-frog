import type * as React from "react"
import { useSelector } from "@tanstack/react-store"
import { useCallback } from "react"
import { Field, FieldError, FieldLabel } from "@/components/ui/base-ui/field"
import { Select } from "@/components/ui/base-ui/select"
import { useFieldContext } from "./form-context"

type SelectFieldProps = React.ComponentProps<typeof Select> & {
  label: React.ReactNode
}

export function SelectField(
  { label, ...props }: SelectFieldProps,
) {
  const field = useFieldContext<string | undefined>()
  const errors = useSelector(field.store, state => state.meta.errors)
  const hasError = errors.length > 0

  const handleValueChange = useCallback((value: unknown) => {
    if (typeof value !== "string")
      return
    field.handleChange(value)
  }, [field])

  return (
    <Field invalid={hasError}>
      <FieldLabel nativeLabel={false} render={<div />}>
        {label}
      </FieldLabel>
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
