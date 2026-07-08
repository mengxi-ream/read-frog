import { cn } from "@/utils/styles/utils"

export function ConfigCard({
  id,
  title,
  description,
  children,
  className,
  titleClassName,
}: {
  id?: string
  title: React.ReactNode
  description: React.ReactNode
  children: React.ReactNode
  className?: string
  titleClassName?: string
}) {
  return (
    <section
      id={id}
      className={cn(
        "flex flex-col gap-y-6 py-6 lg:flex-row lg:gap-x-[50px] xl:gap-x-[100px]",
        className,
      )}
    >
      <div className="shrink-0 lg:basis-2/5">
        <h2 className={cn("mb-1 text-lg font-bold", titleClassName)}>{title}</h2>
        <div className="text-sm text-muted-foreground">{description}</div>
      </div>
      <div className="min-w-0 lg:basis-3/5">{children}</div>
    </section>
  )
}
