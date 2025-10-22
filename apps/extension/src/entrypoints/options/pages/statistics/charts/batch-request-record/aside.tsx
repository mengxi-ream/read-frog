import { i18n } from '#imports'
import { Tabs, TabsList, TabsTrigger } from '@repo/ui/components/tabs'
import { useAtom } from 'jotai'
import { useBatchRequestRecords } from '@/hooks/use-batch-request-record'
import { calculateAverageSavePercentage } from '@/utils/batch-request-record'
import { recentDayAtom } from './atom'

const recentDays = ['5', '7', '30', '60'] as const

export default function Aside() {
  const [recentDay, setRecentDay] = useAtom(recentDayAtom)
  const daysBack = Number(recentDay) - 1

  const { currentPeriodRecords } = useBatchRequestRecords(daysBack)

  const averageSavePercentage = calculateAverageSavePercentage(currentPeriodRecords)

  return (
    <aside className="w-80 h-full flex flex-col py-4">
      <div className="flex flex-col items-start justify-between gap-2">
        <h2 className="items-center leading-relax text-2xl">
          {i18n.t('options.statistics.batchRequest.title')}
        </h2>
        <span className="items-center leading-relax text-base text-gray-500 dark:text-gray-400">
          {i18n.t('options.statistics.batchRequest.description')}
        </span>
      </div>
      <div className="w-full flex-auto flex items-center justify-start">
        <h1 className="text-7xl font-medium leading-none">{averageSavePercentage}</h1>
      </div>
      <Tabs className="w-full flex" defaultValue={recentDay} onValueChange={setRecentDay}>
        <TabsList className="w-full bg-background">
          {
            recentDays.map(recentDay => (
              <TabsTrigger key={recentDay} value={recentDay.toString()} className="transition-none [&[data-state=active]]:bg-primary-weak [&[data-state=active]]:shadow-none">
                {recentDay}
                D
              </TabsTrigger>
            ))
          }
        </TabsList>
      </Tabs>
    </aside>
  )
}
