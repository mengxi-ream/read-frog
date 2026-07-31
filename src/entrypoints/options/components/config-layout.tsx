import type { ReactNode } from "react"
import { cn } from "@/utils/styles/utils"

export interface ConfigLayoutProps {
  title: ReactNode
  description: ReactNode
  children: ReactNode
  className?: string
}

export function ConfigLayout({ title, description, children, className }: ConfigLayoutProps) {
  return (
    <div className={cn("flex w-full flex-col gap-11", className)}>
      <header className="space-y-4">
        <h1 className="text-2xl font-medium text-foreground">{title}</h1>
        <p className="text-base text-muted-foreground">{description}</p>
      </header>
      {children}
    </div>
  )
}
