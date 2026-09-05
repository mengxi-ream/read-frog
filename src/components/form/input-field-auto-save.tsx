import { useSelector } from "@tanstack/react-store"
import { Field, FieldError, FieldLabel } from "@/components/ui/base-ui/field"
import { Input } from "@/components/ui/base-ui/input"
import { useFieldContext } from "./form-context"
import { useAutosaveContext } from "./use-autosave"

export function InputFieldAutoSave({
  label,
  labelAfter,
  labelExtra,
  type,
  onChange,
  onBlur,
  onCompositionStart,
  onCompositionEnd,
  ...props
}: {
  label: React.ReactNode
  /**
   * Sits immediately beside the label, outside the `<label>` element — a link or button nested
   * inside one would be invalid markup and would also steal the label's click.
   */
  labelAfter?: React.ReactNode
  labelExtra?: React.ReactNode
} & React.InputHTMLAttributes<HTMLInputElement>) {
  const autosave = useAutosaveContext()
  const field = useFieldContext<string | number | undefined>()
  const errors = useSelector(field.store, (state) => state.meta.errors)
  const hasError = errors.length > 0

  const updateValue = (value: string) => {
    if (type === "number") {
      if (value === "") field.handleChange(undefined)
      else if (!Number.isNaN(Number(value))) field.handleChange(Number(value))
    } else field.handleChange(value)
  }
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.currentTarget.value
    autosave.edit(() => {
      updateValue(value)
      onChange?.(event)
    })
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
        {...props}
        id={field.name}
        type={type}
        value={field.state.value ?? ""}
        onBlur={(event) => {
          field.handleBlur()
          onBlur?.(event)
          void autosave.flush()
        }}
        onCompositionStart={(event) => {
          autosave.beginComposition(field.name)
          onCompositionStart?.(event)
        }}
        onCompositionEnd={(event) => {
          const value = event.currentTarget.value
          autosave.endComposition(field.name, () => {
            updateValue(value)
            onCompositionEnd?.(event)
          })
        }}
        onChange={handleChange}
        aria-invalid={hasError}
      />
      <FieldError>
        {errors.map((error) => (typeof error === "string" ? error : error?.message)).join(", ")}
      </FieldError>
    </Field>
  )
}
