import type BatchRequestRecord from '@/utils/db/dexie/tables/batch-request-record'
import { Tabs, TabsList, TabsTrigger } from '@repo/ui/components/tabs'
import { useAtom } from 'jotai'
import { useEffect, useEffectEvent, useState } from 'react'
import { getBatchRequestRecordsFromStartDate } from '@/utils/batch-request-records'
import { getStartDateFromDaysBack, numberToPercentage } from '@/utils/utils'
import { batchRequestRecordsAtom } from './atom'

const recentDays = ['5', '7', '30', '60'] as const

const DEFAULT_RECENT_DAY = '5'

export default function Aside() {
  const [batchRequestRecords, setBatchRequestRecords] = useAtom(batchRequestRecordsAtom)

  const averageSavePercentage = calculateAverageSavePercentage(batchRequestRecords)

  const [recentDay, setRecentDay] = useState(DEFAULT_RECENT_DAY)

  const toggleTimeRange = useEffectEvent(async () => {
    const startDate = getStartDateFromDaysBack(Number(recentDay))

    const batchRequestRecords = await getBatchRequestRecordsFromStartDate(startDate)
    setBatchRequestRecords(batchRequestRecords)
  })

  useEffect(() => {
    void toggleTimeRange()
  }, [recentDay])

  return (
    <aside className="w-80 h-full flex flex-col py-4">
      <div className="flex flex-col items-start justify-between gap-2">
        <h2 className="items-center leading-relax text-2xl">
          批量翻译已节省请求
        </h2>
        <span className="items-center leading-relax text-base text-gray-500 dark:text-gray-400">
          周期内批量翻译节省的请求百分比
        </span>
      </div>
      <div className="w-full flex-auto flex items-center justify-start">
        <h1 className="text-7xl font-medium leading-none">{averageSavePercentage}</h1>
      </div>
      <Tabs className="w-full flex" defaultValue={recentDay} onValueChange={setRecentDay}>
        <TabsList className="w-full bg-background">
          {
            recentDays.map(recentDay => (
              <TabsTrigger key={recentDay} value={recentDay.toString()} className="[&[data-state=active]]:bg-primary-weak">
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

export function calculateAverageSavePercentage(batchRequestRecords: BatchRequestRecord[]): string {
  const originalRequestCount = batchRequestRecords.reduce((acc, record) => acc + record.originalRequestCount, 0)
  const batchRequestCount = batchRequestRecords.length
  const averageSavePercent = (originalRequestCount - batchRequestCount) / originalRequestCount
  return numberToPercentage(averageSavePercent)
}
