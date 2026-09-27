import { cn } from "@/utils/styles/utils"

interface EntityEditorLayoutProps {
  list: React.ReactNode
  editor: React.ReactNode
  className?: string
  listClassName?: string
  /**
   * Put the list above the editor when the layout itself is narrow, measured with a container
   * query rather than the viewport, so the options sidebar is accounted for.
   */
  stack?: boolean
}

export function EntityEditorLayout({
  list,
  editor,
  className,
  listClassName,
  stack = false,
}: EntityEditorLayoutProps) {
  if (stack) {
    return (
      <div className="@container/entity-editor">
        <div className={cn("flex flex-col gap-4 @3xl/entity-editor:flex-row", className)}>
          <div
            className={cn(
              "flex w-full flex-col gap-4 @3xl/entity-editor:w-40 @5xl/entity-editor:w-52",
              listClassName,
            )}
          >
            {list}
          </div>
          <div className="min-w-0 flex-1">{editor}</div>
        </div>
      </div>
    )
  }

  return (
    <div className={cn("flex gap-4", className)}>
      <div className={cn("flex w-40 flex-col gap-4 lg:w-52", listClassName)}>{list}</div>
      <div className="min-w-0 flex-1">{editor}</div>
    </div>
  )
}
