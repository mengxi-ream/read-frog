import type { VariantProps } from 'class-variance-authority'
import { Slot } from '@radix-ui/react-slot'
import { cva } from 'class-variance-authority'

import * as React from 'react'

import { cn } from '@/utils/styles/utils'

const buttonVariants = cva(
  'cursor-pointer inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all active:scale-[0.97] duration-150 ease-in-out disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*=\'size-\'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
  {
    variants: {
      variant: {
        'default':
          'bg-primary text-primary-foreground shadow-xs hover:bg-primary/90',
        'destructive':
          'bg-destructive text-white shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60',
        'outline':
          'border bg-background shadow-xs hover:bg-ghost hover:text-ghost-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50',
        'outline-primary':
          'border border-primary bg-background shadow-xs hover:bg-ghost hover:text-ghost-foreground dark:bg-input/30 dark:hover:bg-input/50',
        'secondary':
          'bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80',
        'ghost':
          'hover:bg-ghost text-ghost-foreground dark:hover:bg-ghost/50',
        'link': 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        'default': 'h-8 px-3 py-2 has-[>svg]:px-3',
        'sm': 'h-7 px-2 text-xs has-[>svg]:px-2 gap-x-1',
        'lg': 'h-9 px-7 has-[>svg]:px-4',
        'icon': 'size-8',
        'icon-sm': 'size-7',
        'icon-lg': 'size-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'>
  & VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : 'button'

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export type ButtonProps = VariantProps<typeof buttonVariants>

export { Button, buttonVariants }
