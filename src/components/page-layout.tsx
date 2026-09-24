import type { ReactNode } from "react"
import Container from "@/components/container"
import { cn } from "@/utils/styles/utils"

interface PageLayoutProps {
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  className?: string
  innerClassName?: string
}

/** Shared page width, margins, heading, and content spacing for extension pages. */
export function PageLayout({
  title,
  description,
  children,
  className,
  innerClassName,
}: PageLayoutProps) {
  return (
    <Container className={cn("w-full pt-12 pb-16", className)}>
      <div className="flex w-full flex-col gap-11">
        <header className="space-y-4">
          <h1 className="text-2xl font-medium text-foreground">{title}</h1>
          {description && <p className="text-base text-muted-foreground">{description}</p>}
        </header>
        <div className={cn("@container", innerClassName)}>{children}</div>
      </div>
    </Container>
  )
}
