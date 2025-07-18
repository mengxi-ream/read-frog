import { cn } from '@/utils/tailwind'

export function FieldWithLabel(
  { id, label, children, className }:
  { id: string, label: React.ReactNode, children: React.ReactNode, className?: string },
) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children}
    </div>
  )
}
