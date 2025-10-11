import type { VariantProps } from 'class-variance-authority'
import { cn } from '@repo/ui/lib/utils'
import { cva } from 'class-variance-authority'
import Image from 'next/image'

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
  'object-contain',
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

interface ProviderIconProps extends VariantProps<typeof providerIconVariants> {
  logo: string
  name?: string
  className?: string
}

export default function ProviderIcon({ logo, name = '', size, className }: ProviderIconProps) {
  const sizeMap = {
    sm: 11,
    base: 14,
    md: 20,
    lg: 24,
    xl: 28,
  } as const

  const sizeValue = sizeMap[size || 'base']

  return (
    <div className={cn(providerIconVariants({ size }), className)}>
      <div className={iconContainerVariants({ size })}>
        <Image
          src={logo}
          alt={name}
          className={iconVariants({ size })}
          width={sizeValue}
          height={sizeValue}
        />
      </div>
    </div>
  )
}
