import { Input } from '@repo/ui/components/input'
import { useStore } from '@tanstack/react-form'
import { FieldWithLabel } from '@/entrypoints/options/components/field-with-label'
import { useFieldContext } from '../form-context'

export function InputField(
  { formForSubmit, label, ...props }:
  { formForSubmit: { handleSubmit: () => void }, label: React.ReactNode } & React.InputHTMLAttributes<HTMLInputElement>,
) {
  const field = useFieldContext<string | undefined>()
  const errors = useStore(field.store, state => state.meta.errors)
  const isValid = useStore(field.store, state => state.meta.isValid)

  return (
    <FieldWithLabel
      label={label}
      id={field.name}
    >
      <Input
        id={field.name}
        value={field.state.value ?? ''}
        onBlur={field.handleBlur}
        onChange={(e) => {
          field.handleChange(e.target.value)
          void formForSubmit.handleSubmit()
        }}
        aria-invalid={!isValid}
        aria-describedby={!isValid ? `${field.name}-error` : undefined}
        {...props}
      />
      {!isValid && (
        <em id={`${field.name}-error`} className="text-sm text-destructive mt-1">
          {errors.map(error =>
            typeof error === 'string' ? error : error?.message,
          ).join(', ')}
        </em>
      )}
    </FieldWithLabel>
  )
}
