import { Icon } from "@iconify/react"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { cn } from "@/utils/styles/utils"

interface EntityListRailProps {
  children: React.ReactNode
  className?: string
  containerClassName?: string
}

export function EntityListRail({ children, className, containerClassName }: EntityListRailProps) {
  const [canScroll, setCanScroll] = useState(false)
  const [isScrolledToBottom, setIsScrolledToBottom] = useState(true)
  const [isScrolledToTop, setIsScrolledToTop] = useState(true)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const timeoutId = setTimeout(() => {
      const container = scrollContainerRef.current
      if (!container) {
        return
      }

      const nextCanScroll = container.scrollHeight > container.clientHeight
      const nextIsAtBottom =
        Math.abs(container.scrollHeight - container.clientHeight - container.scrollTop) < 2
      const nextIsAtTop = container.scrollTop < 2

      setCanScroll(nextCanScroll)
      setIsScrolledToBottom(nextIsAtBottom || !nextCanScroll)
      setIsScrolledToTop(nextIsAtTop)
    }, 100)

    return () => clearTimeout(timeoutId)
  }, [children])

  useEffect(() => {
    const handleScroll = () => {
      const container = scrollContainerRef.current
      if (!container) {
        return
      }

      const nextCanScroll = container.scrollHeight > container.clientHeight
      const nextIsAtBottom =
        Math.abs(container.scrollHeight - container.clientHeight - container.scrollTop) < 2
      const nextIsAtTop = container.scrollTop < 2

      setCanScroll(nextCanScroll)
      setIsScrolledToBottom(nextIsAtBottom || !nextCanScroll)
      setIsScrolledToTop(nextIsAtTop)
    }

    const container = scrollContainerRef.current
    if (!container) {
      return undefined
    }

    container.addEventListener("scroll", handleScroll)
    const resizeObserver = new ResizeObserver(() => {
      handleScroll()
    })
    resizeObserver.observe(container)

    const timeoutId = setTimeout(handleScroll, 50)

    return () => {
      clearTimeout(timeoutId)
      container.removeEventListener("scroll", handleScroll)
      resizeObserver.disconnect()
    }
  }, [])

  return (
    <div className={cn("relative", className)}>
      {canScroll && !isScrolledToTop && (
        <div className="pointer-events-none absolute top-0 right-0 left-0 z-10 flex h-8 items-center justify-center bg-linear-to-b from-background to-transparent">
          <Icon icon="tabler:chevron-up" className="size-4 animate-bounce text-muted-foreground" />
        </div>
      )}
      <div
        ref={scrollContainerRef}
        style={{ overflowAnchor: "none" }}
        className={cn(
          "max-h-[720px] [scrollbar-width:none] overflow-y-auto [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
          containerClassName,
        )}
      >
        {children}
      </div>
      {canScroll && !isScrolledToBottom && (
        <div className="pointer-events-none absolute right-0 bottom-0 left-0 flex h-8 items-center justify-center bg-linear-to-t from-background to-transparent">
          <Icon
            icon="tabler:chevron-down"
            className="size-4 animate-bounce text-muted-foreground"
          />
        </div>
      )}
    </div>
  )
}
