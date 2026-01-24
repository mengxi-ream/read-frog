import { Field as FieldPrimitive } from '@base-ui/react/field'

import * as React from 'react'
import { cn } from '@/utils/styles/utils'

function FieldRoot({ className, ...props }: FieldPrimitive.Root.Props) {
  return (
    <FieldPrimitive.Root
      data-slot="field"
      className={cn('flex flex-col items-start gap-1', className)}
      {...props}
    />
  )
}

function FieldLabel({ className, ...props }: FieldPrimitive.Label.Props) {
  return (
    <FieldPrimitive.Label
      data-slot="field-label"
      className={cn(
        'text-sm font-medium text-foreground',
        className,
      )}
      {...props}
    />
  )
}

function FieldDescription({ className, ...props }: FieldPrimitive.Description.Props) {
  return (
    <FieldPrimitive.Description
      data-slot="field-description"
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  )
}

function FieldControl({ ref: forwardedRef, className, ...props }: FieldPrimitive.Control.Props & { ref?: React.RefObject<HTMLInputElement | null> }) {
  return (
    <FieldPrimitive.Control
      ref={forwardedRef}
      data-slot="field-control"
      className={cn(
        'h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground',
        'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
        className,
      )}
      {...props}
    />
  )
}

function FieldError({ className, ...props }: FieldPrimitive.Error.Props) {
  return (
    <FieldPrimitive.Error
      data-slot="field-error"
      className={cn('text-sm text-destructive', className)}
      {...props}
    />
  )
}

export {
  FieldControl,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldRoot,
}
