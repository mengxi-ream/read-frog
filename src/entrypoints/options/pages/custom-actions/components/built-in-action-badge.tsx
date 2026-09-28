import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/base-ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/base-ui/tooltip"
import {
  BUILT_IN_DICTIONARY_ACTION_ID,
  BUILT_IN_SENTENCE_ANALYSIS_ACTION_ID,
} from "@/utils/constants/custom-action"
import { i18n } from "@/utils/i18n"

const BADGE_DATE = "2026-09-27"
const BADGE_YEAR = 2026
const BADGE_MONTH_INDEX = 8
const BADGE_DAY = 27

// Construct both boundaries in the viewer's local time zone. Adding calendar
// days also keeps the 30-day window correct across daylight saving changes.
export function isBuiltInActionBadgeVisible(now: Date): boolean {
  const start = new Date(BADGE_YEAR, BADGE_MONTH_INDEX, BADGE_DAY)
  const end = new Date(BADGE_YEAR, BADGE_MONTH_INDEX, BADGE_DAY + 30)
  return now >= start && now < end
}

export function BuiltInActionBadge({ actionId }: { actionId: string }) {
  const [now, setNow] = useState(() => new Date())

  // An options page can stay open across midnight, including the expiry day.
  useEffect(() => {
    if (now >= new Date(BADGE_YEAR, BADGE_MONTH_INDEX, BADGE_DAY + 30)) return undefined

    const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
    const timer = window.setTimeout(
      () => setNow(new Date()),
      nextMidnight.getTime() - now.getTime(),
    )
    return () => window.clearTimeout(timer)
  }, [now])

  if (!isBuiltInActionBadgeVisible(now)) return null

  const isNew = actionId === BUILT_IN_SENTENCE_ANALYSIS_ACTION_ID
  if (!isNew && actionId !== BUILT_IN_DICTIONARY_ACTION_ID) return null

  const key = "options.selectionToolbar.customActions.badges"

  return (
    <div className="absolute -top-2 right-2 flex items-center justify-center">
      <Tooltip>
        <TooltipTrigger
          render={<Badge className="cursor-default bg-blue-500" size="sm" tabIndex={0} />}
        >
          {i18n.t(`${key}.${isNew ? "new" : "updated"}`)}
        </TooltipTrigger>
        <TooltipContent>
          {i18n.t(`${key}.${isNew ? "createdFrom" : "updatedFrom"}`, [BADGE_DATE])}
        </TooltipContent>
      </Tooltip>
    </div>
  )
}
