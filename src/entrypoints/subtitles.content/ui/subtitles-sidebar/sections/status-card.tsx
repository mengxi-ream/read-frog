import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/base-ui/empty"

export function StatusCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode
  title: string
  children?: React.ReactNode
}) {
  return (
    <Empty className="min-h-full p-6">
      <EmptyHeader>
        <EmptyMedia variant="icon">{icon}</EmptyMedia>
        <EmptyTitle className="font-normal">{title}</EmptyTitle>
      </EmptyHeader>
      {children}
    </Empty>
  )
}
