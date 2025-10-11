import { cn } from '@repo/ui/lib/utils'

export function Spinner({ className }: { className?: string }) {
  return (
    <div
      className={cn('notranslate inline-block rounded-full animate-spin size-1.5 mx-1 align-middle border-3 border-muted border-t-primary box-content!', className)}
    />
  )
}
