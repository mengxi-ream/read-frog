import { cn } from "@/utils/styles/utils"

interface EntityListRailProps {
  children: React.ReactNode
  className?: string
}

export function EntityListRail({ children, className }: EntityListRailProps) {
  return (
    <div
      style={{ overflowAnchor: "none" }}
      // The edge fades are the overflow cue, so the scrollbar only hides where they render.
      className={cn(
        "max-h-[720px] overflow-y-auto scroll-driven:no-scrollbar scroll-driven:scroll-fade",
        className,
      )}
    >
      {children}
    </div>
  )
}
