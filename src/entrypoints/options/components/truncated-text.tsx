import { useLayoutEffect, useRef, useState } from "react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/base-ui/tooltip"
import { cn } from "@/utils/styles/utils"

/**
 * Single-line text that ellipsises, and reveals the full value on hover ONLY
 * when it was actually cut off.
 *
 * A tooltip that repeats text the reader can already see is noise, so the
 * overflow is measured rather than assumed. The measurement needs a
 * `ResizeObserver`: the cut-off point moves with the column width, which changes
 * with the window, the sidebar collapsing, and the table's own layout — none of
 * which re-render this component on their own.
 *
 * The trigger element is rendered unconditionally and only the tooltip CONTENT
 * is conditional. Toggling the wrapper instead would remount the span on every
 * measurement flip, which is both wasteful and a way to lose the ref mid-measure.
 *
 * `text` is a plain string rather than children so the measurement and the
 * tooltip cannot disagree about what the full value is.
 *
 * Requires an ancestor that constrains width — inside a table, that means
 * `table-fixed`, or every cell simply grows and nothing ever truncates.
 */
export function TruncatedText({ text, className }: { text: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [isTruncated, setIsTruncated] = useState(false)

  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return undefined

    const measure = () => {
      // +1: sub-pixel layout can report a scrollWidth a hair over clientWidth on
      // text that is not visually clipped at all. Empty text is never clipped.
      setIsTruncated(text.length > 0 && element.scrollWidth > element.clientWidth + 1)
    }

    // Runs on mount and whenever `text` changes — the box can keep its size
    // while the content changes, which is what a search filter does to a row.
    measure()

    // And on resize: the cut-off point moves with the column width, which
    // changes with the window and with the sidebar collapsing, neither of which
    // re-renders this component.
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [text])

  return (
    <Tooltip>
      <TooltipTrigger render={<span ref={ref} className={cn("block truncate", className)} />}>
        {text}
      </TooltipTrigger>
      {isTruncated && <TooltipContent className="max-w-100 break-words">{text}</TooltipContent>}
    </Tooltip>
  )
}
