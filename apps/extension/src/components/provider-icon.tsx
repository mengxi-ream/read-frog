import type { VariantProps } from 'class-variance-authority'
import { cn } from '@repo/ui/lib/utils'
import { cva } from 'class-variance-authority'

const providerIconVariants = cva(
  'flex items-center min-w-0',
  {
    variants: {
      size: {
        sm: 'gap-1.5',
        base: 'gap-2',
        md: 'gap-3',
        lg: 'gap-4',
        xl: 'gap-5',
      },
    },
    defaultVariants: {
      size: 'base',
    },
  },
)

const iconContainerVariants = cva(
  'rounded-full bg-white dark:bg-muted border border-border flex items-center justify-center flex-shrink-0',
  {
    variants: {
      size: {
        sm: 'size-5',
        base: 'size-6',
        md: 'size-8',
        lg: 'size-10',
        xl: 'size-12',
      },
    },
    defaultVariants: {
      size: 'base',
    },
  },
)

const iconVariants = cva(
  '',
  {
    variants: {
      size: {
        sm: 'size-[11px]',
        base: 'size-3.5',
        md: 'size-5',
        lg: 'size-6',
        xl: 'size-7',
      },
    },
    defaultVariants: {
      size: 'base',
    },
  },
)

const textVariants = cva(
  'truncate',
  {
    variants: {
      size: {
        sm: 'text-sm',
        base: 'text-base',
        md: 'text-md',
        lg: 'text-lg',
        xl: 'text-xl',
      },
    },
    defaultVariants: {
      size: 'base',
    },
  },
)

interface ProviderIconProps extends VariantProps<typeof providerIconVariants> {
  logo: string
  name?: string
  className?: string
  textClassName?: string
}

export default function ProviderIcon({ logo, name, size, className, textClassName }: ProviderIconProps) {
  return (
    <div className={cn(providerIconVariants({ size }), className)}>
      <div className={iconContainerVariants({ size })}>
        <img
          src={logo}
          alt={name}
          className={iconVariants({ size })}
        />
      </div>
      {name && <span className={cn(textVariants({ size }), textClassName)}>{name}</span>}
    </div>
  )
}
