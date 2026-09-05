import type * as React from "react"
import { useSelector } from "@tanstack/react-store"
import { useCallback } from "react"
import { Field, FieldError, FieldTitle } from "@/components/ui/base-ui/field"
import { Select } from "@/components/ui/base-ui/select"
import { useFieldContext } from "./form-context"
import { useAutosaveContext } from "./use-autosave"

type SelectFieldAutoSaveProps = React.ComponentProps<typeof Select> & {
  label: React.ReactNode
  labelExtra?: React.ReactNode
}

export function SelectFieldAutoSave({
  label,
  labelExtra,
  onValueChange,
  ...props
}: SelectFieldAutoSaveProps) {
  const autosave = useAutosaveContext()
  const field = useFieldContext<string | undefined>()
  const errors = useSelector(field.store, (state) => state.meta.errors)
  const hasError = errors.length > 0

  const handleValueChange = useCallback(
    (...[value, details]: Parameters<NonNullable<SelectFieldAutoSaveProps["onValueChange"]>>) => {
      if (typeof value !== "string") return
      autosave.edit(
        () => {
          field.handleChange(value)
          onValueChange?.(value, details)
        },
        { immediate: true },
      )
    },
    [field, autosave, onValueChange],
  )

  return (
    <Field data-invalid={hasError}>
      <div className="flex w-full items-end justify-between">
        <FieldTitle>{label}</FieldTitle>
        {labelExtra}
      </div>
      <Select {...props} value={field.state.value} onValueChange={handleValueChange}>
        {props.children}
      </Select>
      <FieldError>
        {errors.map((error) => (typeof error === "string" ? error : error?.message)).join(", ")}
      </FieldError>
    </Field>
  )
}
