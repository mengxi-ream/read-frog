import type { ReactNode } from "react"
import { cn } from "@/utils/styles/utils"

export interface ConfigItemProps {
  id?: string
  title: ReactNode
  description: ReactNode
  children: ReactNode
  className?: string
  titleClassName?: string
}

export function ConfigItem({
  id,
  title,
  description,
  children,
  className,
  titleClassName,
}: ConfigItemProps) {
  return (
    <div
      id={id}
      className={cn("relative flex w-full flex-wrap items-center justify-between gap-3", className)}
    >
      <div className="min-w-[320px] flex-[3_1_0%]">
        <div className="flex flex-col items-start justify-start gap-1">
          <h3 className={cn("text-sm leading-5 font-medium", titleClassName)}>{title}</h3>
          <div className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
            {description}
          </div>
        </div>
      </div>
      <div className="flex flex-[1_1_0%] flex-col items-end justify-start">{children}</div>
    </div>
  )
}
