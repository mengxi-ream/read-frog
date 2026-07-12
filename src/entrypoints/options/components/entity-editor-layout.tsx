import { cn } from "@/utils/styles/utils"

interface EntityEditorLayoutProps {
  list: React.ReactNode
  editor: React.ReactNode
  className?: string
  listClassName?: string
}

export function EntityEditorLayout({
  list,
  editor,
  className,
  listClassName,
}: EntityEditorLayoutProps) {
  return (
    <div className={cn("flex gap-4", className)}>
      <div className={cn("flex w-40 flex-col gap-4 lg:w-52", listClassName)}>{list}</div>
      <div className="min-w-0 flex-1">{editor}</div>
    </div>
  )
}
