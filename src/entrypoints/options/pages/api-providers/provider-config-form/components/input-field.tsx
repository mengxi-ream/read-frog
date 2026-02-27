import { useStore } from "@tanstack/react-form"
import { Field, FieldLabel } from "@/components/ui/base-ui/field"
import { Input } from "@/components/ui/base-ui/input"
import { useFieldContext } from "../form-context"

export function InputField(
  { formForSubmit, label, labelExtra, type, ...props }:
  { formForSubmit: { handleSubmit: () => void }, label: React.ReactNode, labelExtra?: React.ReactNode } & React.InputHTMLAttributes<HTMLInputElement>,
) {
  const field = useFieldContext<string | number | undefined>()
  const errors = useStore(field.store, state => state.meta.errors)
  const isValid = useStore(field.store, state => state.meta.isValid)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value

    if (type === "number") {
      // For number inputs: empty string -> undefined, valid number -> number
      if (value === "") {
        field.handleChange(undefined)
      }
      else {
        const num = Number(value)
        if (!Number.isNaN(num)) {
          field.handleChange(num)
        }
      }
    }
    else {
      field.handleChange(value)
    }

    void formForSubmit.handleSubmit()
  }

  return (
    <Field>
      <div className="flex items-end justify-between w-full">
        <FieldLabel nativeLabel={false} render={<div />}>
          {label}
        </FieldLabel>
        {labelExtra}
      </div>
      <Input
        id={field.name}
        type={type}
        value={field.state.value ?? ""}
        onBlur={field.handleBlur}
        onChange={handleChange}
        aria-invalid={!isValid}
        {...props}
      />
      {errors.length > 0 && (
        <span className="text-sm font-normal text-destructive">
          {errors.map(error => typeof error === "string" ? error : error?.message).join(", ")}
        </span>
      )}
    </Field>
  )
}
