import type { InsertCell } from "@/components/ui/insertable-textarea"
import { useSelector } from "@tanstack/react-store"
import { Field, FieldError, FieldLabel } from "@/components/ui/base-ui/field"
import { QuickInsertableTextarea } from "@/components/ui/insertable-textarea"
import { useFieldContext } from "./form-context"

interface QuickInsertableTextareaFieldProps {
  label: React.ReactNode
  insertCells?: InsertCell[]
  className?: string
  placeholder?: string
}

export function QuickInsertableTextareaField({
  label,
  insertCells,
  className,
  placeholder,
}: QuickInsertableTextareaFieldProps) {
  const field = useFieldContext<string>()
  const errors = useSelector(field.store, state => state.meta.errors)
  const hasError = errors.length > 0

  return (
    <Field invalid={hasError}>
      <FieldLabel>{label}</FieldLabel>
      <QuickInsertableTextarea
        value={field.state.value}
        onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => {
          field.handleChange(event.target.value)
        }}
        placeholder={placeholder}
        aria-invalid={hasError}
        className={className}
        insertCells={insertCells}
      />
      <FieldError match={hasError}>
        {errors.map(error => typeof error === "string" ? error : error?.message).join(", ")}
      </FieldError>
    </Field>
  )
}
