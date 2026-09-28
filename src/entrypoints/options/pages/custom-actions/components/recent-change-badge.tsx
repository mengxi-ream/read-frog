import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/base-ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/base-ui/tooltip"
import { i18n } from "@/utils/i18n"

type ChangeKind = "new" | "updated"

function localDate(date: string, daysAfter = 0): Date {
  const [year, month, day] = date.split("-").map(Number)
  return new Date(year!, month! - 1, day! + daysAfter)
}

export function isRecentChangeVisible(date: string, now: Date): boolean {
  const start = localDate(date)
  const end = localDate(date, 30)
  return now >= start && now < end
}

export function RecentChangeBadge({ kind, date }: { kind: ChangeKind; date: string }) {
  const [now, setNow] = useState(() => new Date())

  // Keep an already-open settings page in sync with the user's local calendar.
  useEffect(() => {
    if (now >= localDate(date, 30)) return undefined

    const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
    const timer = window.setTimeout(
      () => setNow(new Date()),
      nextMidnight.getTime() - now.getTime(),
    )
    return () => window.clearTimeout(timer)
  }, [date, now])

  if (!isRecentChangeVisible(date, now)) return null

  const key = "options.selectionToolbar.customActions.badges"

  return (
    <div className="absolute -top-2 right-2 flex items-center justify-center">
      <Tooltip>
        <TooltipTrigger
          render={<Badge className="cursor-default bg-blue-500" size="sm" tabIndex={0} />}
        >
          {i18n.t(`${key}.${kind}`)}
        </TooltipTrigger>
        <TooltipContent>
          {i18n.t(`${key}.${kind === "new" ? "createdFrom" : "updatedFrom"}`, [date])}
        </TooltipContent>
      </Tooltip>
    </div>
  )
}
