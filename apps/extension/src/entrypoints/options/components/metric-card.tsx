import { Icon } from '@iconify/react'
import { Card, CardContent } from '@repo/ui/components/card'
import { IconCircleArrowDownRightFilled, IconCircleArrowUpRightFilled, IconMinus } from '@tabler/icons-react'
import { Activity } from 'react'
import { addThousandsSeparator, numberToPercentage } from '@/utils/utils'

export function MetricCard(
  { title, metric, comparison, icon }:
  { title: string, metric: number, icon: string, comparison?: number },
) {
  return (
    <Card className="flex flex-row hover:scale-[1.01] hover:-translate-y-1/12 transition-all duration-200 shadow-xs">
      <CardContent className="flex gap-4 w-full">
        <div className="h-full flex items-center">
          <div className="size-10 flex items-center justify-center rounded-xl bg-zinc-200 text-black dark:bg-zinc-800 dark:text-white">
            <Icon icon={icon} className="size-5" />
          </div>
        </div>
        <div className="h-full flex flex-col gap-3 w-full items-start">
          <div className="leading-none text-muted-foreground text-sm">{title}</div>
          <div className="leading-none text-lg font-semibold tabular-nums flex flex-wrap gap-x-3 items-center">
            {addThousandsSeparator(metric)}
            <Comparison comparison={comparison} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function Comparison({ comparison }: { comparison?: number }) {
  if (comparison === undefined)
    return null

  const comparisonText = numberToPercentage(comparison)

  return (
    <>
      <Activity mode={comparison > 0 ? 'visible' : 'hidden'}>
        <div className="h-full text-base flex items-center gap-1 text-primary-strong">
          <IconCircleArrowUpRightFilled className="size-5" />
          {comparisonText}
        </div>
      </Activity>
      <Activity mode={comparison === 0 ? 'visible' : 'hidden'}>
        <div className="h-full text-base flex items-center gap-1 text-foreground">
          <IconMinus className="size-5" />
        </div>
      </Activity>
      <Activity mode={comparison < 0 ? 'visible' : 'hidden'}>
        <div className="h-full text-base flex items-center gap-1 text-destructive">
          <IconCircleArrowDownRightFilled className="size-5" />
          {comparisonText}
        </div>
      </Activity>
    </>
  )
}
