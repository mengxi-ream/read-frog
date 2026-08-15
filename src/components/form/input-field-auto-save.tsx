import { useSelector } from "@tanstack/react-store"
import { Field, FieldError, FieldLabel } from "@/components/ui/base-ui/field"
import { Input } from "@/components/ui/base-ui/input"
import { useFieldContext } from "./form-context"

export function InputFieldAutoSave({
  formForSubmit,
  label,
  labelAfter,
  labelExtra,
  type,
  ...props
}: {
  formForSubmit: { handleSubmit: () => void }
  label: React.ReactNode
  /**
   * Sits immediately beside the label, outside the `<label>` element — a link or button nested
   * inside one would be invalid markup and would also steal the label's click.
   */
  labelAfter?: React.ReactNode
  labelExtra?: React.ReactNode
} & React.InputHTMLAttributes<HTMLInputElement>) {
  const field = useFieldContext<string | number | undefined>()
  const errors = useSelector(field.store, (state) => state.meta.errors)
  const hasError = errors.length > 0

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value

    if (type === "number") {
      if (value === "") {
        field.handleChange(undefined)
      } else {
        const num = Number(value)
        if (!Number.isNaN(num)) {
          field.handleChange(num)
        }
      }
    } else {
      field.handleChange(value)
    }

    formForSubmit.handleSubmit()
  }

  return (
    <Field data-invalid={hasError}>
      <div className="flex w-full items-end justify-between gap-2">
        <div className="flex items-center gap-2">
          <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
          {labelAfter}
        </div>
        {labelExtra}
      </div>
      <Input
        id={field.name}
        type={type}
        value={field.state.value ?? ""}
        onBlur={field.handleBlur}
        onChange={handleChange}
        aria-invalid={hasError}
        {...props}
      />
      <FieldError>
        {errors.map((error) => (typeof error === "string" ? error : error?.message)).join(", ")}
      </FieldError>
    </Field>
  )
}
