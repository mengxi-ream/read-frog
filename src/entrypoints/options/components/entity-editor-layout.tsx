import { cn } from "@/utils/styles/utils"

interface EntityEditorLayoutProps {
  list: React.ReactNode
  editor: React.ReactNode
  className?: string
  listClassName?: string
}

/**
 * Puts the list above the editor when the layout itself is narrow, measured with a container
 * query rather than the viewport, so the options sidebar is accounted for. The breakpoint is the
 * list's 13rem, the 1rem gap and a 37rem minimum for the editor beside them.
 */
export function EntityEditorLayout({
  list,
  editor,
  className,
  listClassName,
}: EntityEditorLayoutProps) {
  return (
    <div className="@container/entity-editor">
      <div className={cn("flex flex-col gap-4 @min-[51rem]/entity-editor:flex-row", className)}>
        <div
          className={cn(
            "flex w-full flex-col gap-4 @min-[51rem]/entity-editor:w-52",
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
