import type { InsertCell } from "@/components/ui/insertable-textarea"
import { useStore } from "@tanstack/react-form"
import { Field, FieldLabel } from "@/components/ui/base-ui/field"
import { QuickInsertableTextarea } from "@/components/ui/insertable-textarea"
import { useFieldContext } from "./form-context"

interface QuickInsertableTextareaFieldProps {
  formForSubmit: { handleSubmit: () => void }
  label: React.ReactNode
  insertCells?: InsertCell[]
  className?: string
}

export function QuickInsertableTextareaField({
  formForSubmit,
  label,
  insertCells,
  className,
}: QuickInsertableTextareaFieldProps) {
  const field = useFieldContext<string>()
  const errors = useStore(field.store, state => state.meta.errors)

  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <QuickInsertableTextarea
        value={field.state.value}
        onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => {
          field.handleChange(event.target.value)
          void formForSubmit.handleSubmit()
        }}
        className={className}
        insertCells={insertCells}
      />
      {errors.length > 0 && (
        <span className="text-sm font-normal text-destructive">
          {errors.map(error => typeof error === "string" ? error : error?.message).join(", ")}
        </span>
      )}
    </Field>
  )
}
