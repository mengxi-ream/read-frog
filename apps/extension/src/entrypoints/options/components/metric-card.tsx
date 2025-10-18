import { Icon } from '@iconify/react'
import { Card, CardContent } from '@repo/ui/components/card'
import { cn } from '@repo/ui/lib/utils'
import { IconCircleArrowDownRightFilled, IconCircleArrowUpRightFilled } from '@tabler/icons-react'

export function MetricCard(
  { title, value, comparison, icon }:
  { title: string, value: string, icon: string, comparison: number },
) {
  const negative = comparison < 0
  const comparisonText = `${negative ? '' : '+'}${comparison}%`

  return (
    <div className="hover:scale-102 hover:-translate-y-1/8 transition-all duration-300 grid grid-cols-1 *:data-[slot=card]:shadow-xs @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
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
              <div className={
                cn(
                  'h-full text-base flex items-center gap-1',
                  negative ? 'text-destructive/80' : 'text-primary-strong',
                )
              }
              >
                { comparison >= 0 ? <IconCircleArrowUpRightFilled className="size-5" /> : <IconCircleArrowDownRightFilled className="size-5" /> }
                {comparisonText}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
