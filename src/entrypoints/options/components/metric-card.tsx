import { Icon } from "@iconify/react"
import {
  IconCircleArrowDownRightFilled,
  IconCircleArrowUpRightFilled,
  IconMinus,
} from "@tabler/icons-react"
import { Activity } from "react"
import { Card, CardContent } from "@/components/ui/base-ui/card"
import { addThousandsSeparator, numberToPercentage } from "@/utils/utils"

export function MetricCard({
  title,
  metric,
  comparison,
  icon,
}: {
  title: string
  metric: number
  icon: string
  comparison?: number
}) {
  return (
    <Card className="flex flex-row shadow-xs transition-all duration-200 hover:-translate-y-1/12 hover:scale-[1.01]">
      <CardContent className="flex w-full gap-4">
        <div className="flex h-full items-center">
          <div className="flex size-10 items-center justify-center rounded-xl bg-zinc-200 text-black dark:bg-zinc-800 dark:text-white">
            <Icon icon={icon} className="size-5" />
          </div>
        </div>
        <div className="flex h-full w-full flex-col items-start gap-3">
          <div className="text-sm leading-none text-muted-foreground">{title}</div>
          <div className="flex flex-wrap items-center gap-x-3 text-lg leading-none font-semibold tabular-nums">
            {addThousandsSeparator(metric)}
            <Comparison comparison={comparison} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function Comparison({ comparison }: { comparison?: number }) {
  if (comparison === undefined) return null

  const comparisonText = numberToPercentage(comparison)

  return (
    <>
      <Activity mode={comparison > 0 ? "visible" : "hidden"}>
        <div className="text-primary-strong flex h-full items-center gap-1 text-base">
          <IconCircleArrowUpRightFilled className="size-5" />
          {comparisonText}
        </div>
      </Activity>
      <Activity mode={comparison === 0 ? "visible" : "hidden"}>
        <div className="flex h-full items-center gap-1 text-base text-foreground">
          <IconMinus className="size-5" />
        </div>
      </Activity>
      <Activity mode={comparison < 0 ? "visible" : "hidden"}>
        <div className="flex h-full items-center gap-1 text-base text-destructive">
          <IconCircleArrowDownRightFilled className="size-5" />
          {comparisonText}
        </div>
      </Activity>
    </>
  )
}
