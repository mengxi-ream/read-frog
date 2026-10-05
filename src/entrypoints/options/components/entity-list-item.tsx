import type { ComponentProps } from "react"
import { Switch } from "@/components/ui/base-ui/switch"
import { cn } from "@/utils/styles/utils"

interface RootProps extends React.ComponentProps<"div"> {
  selected: boolean
}

function Root({ children, className, selected, ...props }: RootProps) {
  return (
    <div
      className={cn(
        "relative cursor-pointer rounded-xl border bg-card p-3 transition-colors",
        selected && "border-primary",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

function Badges({ children }: { children: React.ReactNode }) {
  return children
}

function Content({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex items-center justify-between gap-2", className)}>{children}</div>
}

function Identity({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex min-w-0 items-center gap-2", className)}>{children}</div>
}

function Toggle({ onClick, onPointerDown, ...props }: ComponentProps<typeof Switch>) {
  return (
    <Switch
      onPointerDown={(event) => {
        event.stopPropagation()
        onPointerDown?.(event)
      }}
      onClick={(event) => {
        event.stopPropagation()
        onClick?.(event)
      }}
      {...props}
    />
  )
}

export const EntityListItem = {
  Root,
  Badges,
  Content,
  Identity,
  Toggle,
}
