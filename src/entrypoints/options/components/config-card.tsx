import { cn } from "@/utils/styles/utils"

export function ConfigCard(
  { id, title, description, children, className, titleClassName }:
  { id?: string, title: React.ReactNode, description: React.ReactNode, children: React.ReactNode, className?: string, titleClassName?: string },
) {
  return (
    <section id={id} className={cn("py-4 flex lg:flex-row flex-col lg:gap-x-[40px] xl:gap-x-[80px] gap-y-4", className)}>
      <div className="lg:basis-2/5 shrink-0">
        <h2 className={cn("text-base font-semibold mb-1", titleClassName)}>{title}</h2>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
      <div className="lg:basis-3/5 min-w-0">
        {children}
      </div>
    </section>
  )
}
