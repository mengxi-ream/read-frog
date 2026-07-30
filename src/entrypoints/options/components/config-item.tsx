import type { ReactNode } from "react"
import { cn } from "@/utils/styles/utils"

export interface ConfigItemProps {
  id?: string
  /** Omit to hang the row off the previous item's title instead of giving it one. */
  title?: ReactNode
  description: ReactNode
  children: ReactNode
  /** `vertical` stacks the control under the label — for controls too wide to sit beside it. */
  orientation?: "horizontal" | "vertical"
  className?: string
  titleClassName?: string
}

const LAYOUT = {
  horizontal: {
    root: "flex-wrap items-center justify-between gap-3",
    label: "min-w-[320px] flex-1",
    control: "items-end",
  },
  vertical: {
    root: "flex-col gap-4",
    label: "w-full",
    control: "w-full",
  },
} as const

export function ConfigItem({
  id,
  title,
  description,
  children,
  orientation = "horizontal",
  className,
  titleClassName,
}: ConfigItemProps) {
  const layout = LAYOUT[orientation]

  return (
    <div id={id} className={cn("relative flex w-full", layout.root, className)}>
      <div className={layout.label}>
        <div className="flex flex-col items-start justify-start gap-1">
          {title && (
            <h3 className={cn("text-sm leading-5 font-medium", titleClassName)}>{title}</h3>
          )}
          <div className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
            {description}
          </div>
        </div>
      </div>
      <div className={cn("flex flex-col justify-start", layout.control)}>{children}</div>
    </div>
  )
}
