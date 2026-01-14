import { cn } from '@/utils/styles/tailwind'

export function ConfigCard(
  { title, description, children, className, titleClassName }:
  { title: React.ReactNode, description: React.ReactNode, children: React.ReactNode, className?: string, titleClassName?: string },
) {
  return (
    <section className={cn('py-6 flex lg:flex-row flex-col lg:gap-x-[50px] xl:gap-x-[100px] gap-y-6', className)}>
      <div className="lg:basis-2/5 shrink-0">
        <h2 className={cn('text-lg font-bold mb-1', titleClassName)}>{title}</h2>
        <div className="text-sm text-muted-foreground">{description}</div>
      </div>
      <div className="lg:basis-3/5 min-w-0">
        {children}
      </div>
    </section>
  )
}
