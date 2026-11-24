import type { ReactNode } from "react"
import { Progress, ProgressLabel } from "@/components/ui/base-ui/progress"
import { Skeleton } from "@/components/ui/base-ui/skeleton"
import { cn } from "@/utils/styles/utils"

/**
 * One kind of quota inside the usage card. A sub-heading rather than a
 * ConfigSection: the card already frames the page, and a second rule-and-title
 * per group would box the bars in twice. The id is what `?section=` and the
 * command palette scroll to.
 */
export function UsageGroup({
  id,
  title,
  description,
  children,
}: {
  id: string
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section id={id} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h3 className="text-sm leading-5 font-medium">{title}</h3>
        {description && (
          <p className="text-[13px] leading-[18px] text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </section>
  )
}

/** A line standing in for the bars: signed out, no plan, or the request failed. */
export function UsageNotice({ children }: { children: ReactNode }) {
  return <p className="text-[13px] leading-[18px] text-muted-foreground">{children}</p>
}

/**
 * One quota pool, the same in every group: the pool's name and what is left on
 * the first line, a bar filled with what is LEFT (a fresh pool reads as a full
 * bar), then `meta` and the pool's one date (`note`) at text-xs.
 */
export function UsagePoolRow({
  label,
  remainingText,
  value,
  meta,
  note,
  nearLimit = false,
}: {
  label: ReactNode
  /** Also what a screen reader announces, so "62% left" rather than a bare "62%". */
  remainingText: string
  /** The share left, 0–100. */
  value: number
  meta: ReactNode
  note?: ReactNode
  nearLimit?: boolean
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Progress
        value={value}
        className={cn(
          "gap-x-3 gap-y-1.5",
          nearLimit && "[&_[data-slot=progress-indicator]]:bg-destructive",
        )}
        getAriaValueText={() => remainingText}
      >
        <ProgressLabel className="flex items-center gap-1.5">{label}</ProgressLabel>
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">{remainingText}</span>
      </Progress>
      <div className="flex flex-wrap items-center justify-between gap-x-3 text-xs text-muted-foreground">
        <span className="tabular-nums">{meta}</span>
        {note && <span>{note}</span>}
      </div>
    </div>
  )
}

/**
 * A loading `UsagePoolRow`, line for line: the name and what is left, the bar,
 * then the meta and date line. Same height (54px), so nothing moves when one
 * row loads.
 */
export function UsagePoolRowSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-1.5">
      <div className="flex h-5 items-center justify-between gap-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-20" />
      </div>
      <Skeleton className="h-1.5 w-full rounded-full" />
      <div className="flex h-4 items-center justify-between gap-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-28" />
      </div>
    </div>
  )
}
