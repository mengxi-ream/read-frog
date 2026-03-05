import type { InsertCell } from "@/components/ui/insertable-textarea"
import { useStore } from "@tanstack/react-form"
import { Field, FieldError, FieldLabel } from "@/components/ui/base-ui/field"
import { QuickInsertableTextarea } from "@/components/ui/insertable-textarea"
import { useFieldContext } from "./form-context"

interface QuickInsertableTextareaFieldAutoSaveProps {
  formForSubmit: { handleSubmit: () => void }
  label: React.ReactNode
  insertCells?: InsertCell[]
  className?: string
}

export function QuickInsertableTextareaFieldAutoSave({
  formForSubmit,
  label,
  insertCells,
  className,
}: QuickInsertableTextareaFieldAutoSaveProps) {
  const field = useFieldContext<string>()
  const errors = useStore(field.store, state => state.meta.errors)
  const hasError = errors.length > 0

  return (
    <Field invalid={hasError}>
      <FieldLabel>{label}</FieldLabel>
      <QuickInsertableTextarea
        value={field.state.value}
        onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => {
          field.handleChange(event.target.value)
          void formForSubmit.handleSubmit()
        }}
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
