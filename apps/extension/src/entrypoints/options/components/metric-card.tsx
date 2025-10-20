import { Icon } from '@iconify/react'
import { Card, CardContent } from '@repo/ui/components/card'
import { IconCircleArrowDownRightFilled, IconCircleArrowUpRightFilled, IconMinus } from '@tabler/icons-react'
import { Activity } from 'react'
import { numberToPercentage } from '@/utils/utils'

export function MetricCard(
  { title, value, comparison, icon }:
  { title: string, value: string | number, icon: string, comparison?: number },
) {
  return (
    <div className="hover:scale-[1.01] hover:-translate-y-1/12 transition-all duration-300 grid grid-cols-1 *:data-[slot=card]:shadow-xs @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      <Card className="@container/card flex flex-row py-6">
        <CardContent className="px-5 flex gap-4 w-full">
          <div className="h-full flex items-center">
            <div className="size-10 flex items-center justify-center rounded-xl bg-zinc-200 text-black dark:bg-zinc-800 dark:text-white">
              <Icon icon={icon} className="size-5" />
            </div>
          </div>
          <div className="h-full flex flex-col gap-3 w-full items-start">
            <div className="leading-none text-muted-foreground text-sm">{title}</div>
            <div className="leading-none text-2xl font-semibold tabular-nums @[250px]/card:text-3xl flex flex-col md:flex-row gap-3 items-start md:items-center">
              {value}
              <Comparison comparison={comparison} />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
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
