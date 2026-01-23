import { useCallback, useState } from 'react'
import { z } from 'zod'
import { Input } from '@/components/shadcn/input'
import { cn } from '@/utils/styles/utils'

interface ValidatedInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  schema: z.ZodSchema
  onValidationChange?: (isValid: boolean, error?: string) => void
  validateOn?: 'blur' | 'change'
  showError?: boolean
  errorClassName?: string
  preprocessValue?: (value: string) => string | undefined
}

const DEFAULT_ERROR_MESSAGE = 'Invalid input'

export default function ValidatedInput({
  schema,
  className,
  onValidationChange,
  validateOn = 'blur',
  showError = true,
  errorClassName,
  preprocessValue,
  onChange,
  onBlur,
  ...props
}: ValidatedInputProps) {
  const [error, setError] = useState<string>('')
  const [hasBeenValidated, setHasBeenValidated] = useState(false)

  const validateValue = useCallback(
    (value: string) => {
      try {
        const processedValue = preprocessValue ? preprocessValue(value) : value
        schema.parse(processedValue)
        setError('')
        onValidationChange?.(true)
        return true
      }
      catch (err) {
        const errorMessage = err instanceof z.ZodError
          ? err.issues[0]?.message ?? DEFAULT_ERROR_MESSAGE
          : DEFAULT_ERROR_MESSAGE
        setError(errorMessage)
        onValidationChange?.(false, errorMessage)
        return false
      }
    },
    [schema, onValidationChange, preprocessValue],
  )

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let finalEvent: React.ChangeEvent<HTMLInputElement> = e
    if (preprocessValue) {
      const processedValue = preprocessValue(e.target.value)
      const newEvent = {
        ...e,
        target: {
          ...e.target,
          value: processedValue,
        },
      }
      finalEvent = newEvent as React.ChangeEvent<HTMLInputElement>
    }
    if (schema.safeParse(finalEvent.target.value).success) {
      onChange?.(finalEvent)
    }
    else {
      console.error('Invalid value:', finalEvent.target.value)
    }

    if (validateOn === 'change' || hasBeenValidated) {
      validateValue(finalEvent.target.value)
    }
  }

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    onBlur?.(e)
    setHasBeenValidated(true)

    if (validateOn === 'blur') {
      validateValue(e.target.value)
    }
  }

  const hasError = error && showError && hasBeenValidated

  return (
    <div className="space-y-1">
      <Input
        className={cn(
          hasError
          && 'border-destructive focus-visible:border-destructive focus-visible:ring-destructive/50',
          className,
        )}
        onChange={handleChange}
        onBlur={handleBlur}
        aria-invalid={hasError ? true : undefined}
        aria-describedby={hasError ? 'input-error' : undefined}
        {...props}
      />
      {hasError && (
        <p
          id="input-error"
          className={cn('text-destructive text-sm', errorClassName)}
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  )
}
