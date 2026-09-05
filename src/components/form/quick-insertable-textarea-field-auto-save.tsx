import type { InsertCell } from "@/components/ui/insertable-textarea"
import { useSelector } from "@tanstack/react-store"
import { Field, FieldError, FieldLabel } from "@/components/ui/base-ui/field"
import { QuickInsertableTextarea } from "@/components/ui/insertable-textarea"
import { useFieldContext } from "./form-context"
import { useAutosaveContext } from "./use-autosave"

interface QuickInsertableTextareaFieldAutoSaveProps {
  label: React.ReactNode
  insertCells?: InsertCell[]
  className?: string
  readOnly?: boolean
}

export function QuickInsertableTextareaFieldAutoSave({
  label,
  insertCells,
  className,
  readOnly,
}: QuickInsertableTextareaFieldAutoSaveProps) {
  const autosave = useAutosaveContext()
  const field = useFieldContext<string>()
  const errors = useSelector(field.store, (state) => state.meta.errors)
  const hasError = errors.length > 0

  return (
    <Field data-invalid={hasError}>
      <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
      <QuickInsertableTextarea
        id={field.name}
        value={field.state.value}
        onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => {
          const value = event.currentTarget.value
          autosave.edit(() => field.handleChange(value))
        }}
        onCompositionStart={() => autosave.beginComposition(field.name)}
        onCompositionEnd={(event) => {
          const value = event.currentTarget.value
          autosave.endComposition(field.name, () => field.handleChange(value))
        }}
        onBlur={() => {
          field.handleBlur()
          void autosave.flush()
        }}
        aria-invalid={hasError}
        className={className}
        insertCells={insertCells}
        readOnly={readOnly}
      />
      <FieldError>
        {errors.map((error) => (typeof error === "string" ? error : error?.message)).join(", ")}
      </FieldError>
    </Field>
  )
}
