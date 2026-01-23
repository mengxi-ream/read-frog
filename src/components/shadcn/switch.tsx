import type { VariantProps } from 'class-variance-authority'
import * as SwitchPrimitive from '@radix-ui/react-switch'

import { cva } from 'class-variance-authority'

import * as React from 'react'

import { cn } from '@/utils/styles/utils'

const switchVariants = cva(
  'peer focus-visible:ring-ring focus-visible:ring-offset-background data-[state=unchecked]:bg-input inline-flex h-5 w-10 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'data-[state=checked]:bg-primary',
        monochrome: 'data-[state=checked]:bg-monochrome',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

function Switch({
  className,
  variant,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>
  & VariantProps<typeof switchVariants>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(switchVariants({ variant, className }))}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          'bg-background pointer-events-none block h-4 w-5.75 rounded-full shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-3.25 data-[state=unchecked]:translate-x-0',
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export type SwitchProps = VariantProps<typeof switchVariants>

export { Switch, switchVariants }
