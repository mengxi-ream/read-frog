import Container from "@/components/container"
import { cn } from "@/utils/styles/utils"
import { ConfigLayout } from "./config-layout"

export function PageLayout({
  title,
  description,
  children,
  className,
  innerClassName,
}: {
  title: React.ReactNode
  description: React.ReactNode
  children: React.ReactNode
  className?: string
  innerClassName?: string
}) {
  return (
    <Container className={cn("w-full pt-12 pb-16", className)}>
      <ConfigLayout title={title} description={description}>
        <div className={cn("@container", innerClassName)}>{children}</div>
      </ConfigLayout>
    </Container>
  )
}
