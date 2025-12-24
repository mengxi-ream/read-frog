import { useStore } from '@tanstack/react-form'
import { Field, FieldError, FieldLabel } from '@/components/shadcn/field'
import { Input } from '@/components/shadcn/input'
import { useFieldContext } from '../form-context'

export function InputField(
  { formForSubmit, label, type, ...props }:
  { formForSubmit: { handleSubmit: () => void }, label: React.ReactNode } & React.InputHTMLAttributes<HTMLInputElement>,
) {
  const field = useFieldContext<string | number | undefined>()
  const errors = useStore(field.store, state => state.meta.errors)
  const isValid = useStore(field.store, state => state.meta.isValid)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value

    if (type === 'number') {
      // For number inputs: empty string -> undefined, valid number -> number
      if (value === '') {
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
      <FieldLabel htmlFor={field.name}>
        {label}
      </FieldLabel>
      <Input
        id={field.name}
        type={type}
        value={field.state.value ?? ''}
        onBlur={field.handleBlur}
        onChange={handleChange}
        aria-invalid={!isValid}
        {...props}
      />
      <FieldError
        errors={errors.map(error => ({
          message: typeof error === 'string' ? error : error?.message,
        }))}
      />
    </Field>
  )
}
